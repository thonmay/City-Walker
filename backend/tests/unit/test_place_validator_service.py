"""Unit tests for the place validator service.

Tests the PlaceValidatorService abstract class and GooglePlaceValidatorService implementation.

Requirements: 2.1, 2.2, 2.6
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.place_validator import (
    PlaceValidatorService,
    GooglePlaceValidatorService,
    ValidationResult,
    StructuredQuery,
)
from app.models import Coordinates, POI, PriceLevel, OpeningHours


class TestStructuredQuery:
    """Tests for the StructuredQuery dataclass."""

    def test_basic_query_creation(self) -> None:
        """Test basic query creation with city only."""
        query = StructuredQuery(city="Paris")
        assert query.city == "Paris"
        assert query.area is None
        assert query.poi_types == []
        assert query.keywords == []

    def test_full_query_creation(self) -> None:
        """Test query creation with all fields."""
        query = StructuredQuery(
            city="Paris",
            area="Montmartre",
            poi_types=["restaurant", "cafe"],
            keywords=["romantic", "view"],
        )
        assert query.city == "Paris"
        assert query.area == "Montmartre"
        assert query.poi_types == ["restaurant", "cafe"]
        assert query.keywords == ["romantic", "view"]

    def test_to_search_query_city_only(self) -> None:
        """Test search query generation with city only."""
        query = StructuredQuery(city="Paris")
        search_text = query.to_search_query()
        assert "in Paris" in search_text

    def test_to_search_query_with_area(self) -> None:
        """Test search query generation with area."""
        query = StructuredQuery(city="Paris", area="Montmartre")
        search_text = query.to_search_query()
        assert "in Montmartre" in search_text
        assert "in Paris" in search_text

    def test_to_search_query_with_keywords(self) -> None:
        """Test search query generation with keywords."""
        query = StructuredQuery(city="Paris", keywords=["romantic", "view"])
        search_text = query.to_search_query()
        assert "romantic" in search_text
        assert "view" in search_text
        assert "in Paris" in search_text

    def test_to_search_query_with_poi_types(self) -> None:
        """Test search query generation with POI types."""
        query = StructuredQuery(city="Paris", poi_types=["restaurant", "cafe"])
        search_text = query.to_search_query()
        assert "restaurant" in search_text
        assert "cafe" in search_text

    def test_to_search_query_full(self) -> None:
        """Test search query generation with all fields."""
        query = StructuredQuery(
            city="Paris",
            area="Montmartre",
            poi_types=["restaurant"],
            keywords=["romantic"],
        )
        search_text = query.to_search_query()
        assert "romantic" in search_text
        assert "restaurant" in search_text
        assert "in Montmartre" in search_text
        assert "in Paris" in search_text


class TestValidationResult:
    """Tests for the ValidationResult dataclass."""

    def test_valid_result(self) -> None:
        """Test creating a valid result."""
        poi = POI(
            place_id="test123",
            name="Test Place",
            coordinates=Coordinates(lat=48.8566, lng=2.3522),
            maps_url="https://maps.google.com/?q=place_id:test123",
            confidence=1.0,
        )
        result = ValidationResult(is_valid=True, missing_fields=[], poi=poi)
        assert result.is_valid is True
        assert result.missing_fields == []
        assert result.poi is not None

    def test_invalid_result(self) -> None:
        """Test creating an invalid result."""
        result = ValidationResult(
            is_valid=False,
            missing_fields=["place_id", "name"],
            poi=None,
        )
        assert result.is_valid is False
        assert "place_id" in result.missing_fields
        assert "name" in result.missing_fields
        assert result.poi is None


class TestGooglePlaceValidatorServiceInit:
    """Tests for GooglePlaceValidatorService initialization."""

    def test_default_initialization(self) -> None:
        """Test default initialization values."""
        service = GooglePlaceValidatorService(api_key="test_key")
        assert service._api_key == "test_key"
        assert service._timeout == 30.0
        assert service._client is None

    def test_custom_timeout(self) -> None:
        """Test custom timeout initialization."""
        service = GooglePlaceValidatorService(api_key="test_key", timeout=60.0)
        assert service._timeout == 60.0


class TestGooglePlaceValidatorServiceValidation:
    """Tests for POI validation logic."""

    def setup_method(self) -> None:
        """Set up test fixtures."""
        self.service = GooglePlaceValidatorService(api_key="test_key")

    def test_validate_valid_poi(self) -> None:
        """Test validation of a valid POI."""
        poi_data = {
            "place_id": "ChIJD7fiBh9u5kcRYJSMaMOCCwQ",
            "name": "Eiffel Tower",
            "coordinates": {"lat": 48.8584, "lng": 2.2945},
            "maps_url": "https://maps.google.com/?q=place_id:ChIJD7fiBh9u5kcRYJSMaMOCCwQ",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is True
        assert result.missing_fields == []
        assert result.poi is not None
        assert result.poi.place_id == "ChIJD7fiBh9u5kcRYJSMaMOCCwQ"

    def test_validate_poi_missing_place_id(self) -> None:
        """Test validation fails when place_id is missing."""
        poi_data = {
            "name": "Eiffel Tower",
            "coordinates": {"lat": 48.8584, "lng": 2.2945},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "place_id" in result.missing_fields

    def test_validate_poi_empty_place_id(self) -> None:
        """Test validation fails when place_id is empty."""
        poi_data = {
            "place_id": "",
            "name": "Eiffel Tower",
            "coordinates": {"lat": 48.8584, "lng": 2.2945},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "place_id" in result.missing_fields

    def test_validate_poi_missing_name(self) -> None:
        """Test validation fails when name is missing."""
        poi_data = {
            "place_id": "test123",
            "coordinates": {"lat": 48.8584, "lng": 2.2945},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "name" in result.missing_fields

    def test_validate_poi_empty_name(self) -> None:
        """Test validation fails when name is empty."""
        poi_data = {
            "place_id": "test123",
            "name": "   ",
            "coordinates": {"lat": 48.8584, "lng": 2.2945},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "name" in result.missing_fields

    def test_validate_poi_missing_lat(self) -> None:
        """Test validation fails when lat is missing."""
        poi_data = {
            "place_id": "test123",
            "name": "Test Place",
            "coordinates": {"lng": 2.2945},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "lat" in result.missing_fields

    def test_validate_poi_missing_lng(self) -> None:
        """Test validation fails when lng is missing."""
        poi_data = {
            "place_id": "test123",
            "name": "Test Place",
            "coordinates": {"lat": 48.8584},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "lng" in result.missing_fields

    def test_validate_poi_invalid_lat_too_high(self) -> None:
        """Test validation fails when lat is > 90."""
        poi_data = {
            "place_id": "test123",
            "name": "Test Place",
            "coordinates": {"lat": 91.0, "lng": 2.2945},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "lat" in result.missing_fields

    def test_validate_poi_invalid_lat_too_low(self) -> None:
        """Test validation fails when lat is < -90."""
        poi_data = {
            "place_id": "test123",
            "name": "Test Place",
            "coordinates": {"lat": -91.0, "lng": 2.2945},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "lat" in result.missing_fields

    def test_validate_poi_invalid_lng_too_high(self) -> None:
        """Test validation fails when lng is > 180."""
        poi_data = {
            "place_id": "test123",
            "name": "Test Place",
            "coordinates": {"lat": 48.8584, "lng": 181.0},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "lng" in result.missing_fields

    def test_validate_poi_invalid_lng_too_low(self) -> None:
        """Test validation fails when lng is < -180."""
        poi_data = {
            "place_id": "test123",
            "name": "Test Place",
            "coordinates": {"lat": 48.8584, "lng": -181.0},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "lng" in result.missing_fields

    def test_validate_poi_missing_maps_url(self) -> None:
        """Test validation fails when maps_url is missing."""
        poi_data = {
            "place_id": "test123",
            "name": "Test Place",
            "coordinates": {"lat": 48.8584, "lng": 2.2945},
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "maps_url" in result.missing_fields

    def test_validate_poi_multiple_missing_fields(self) -> None:
        """Test validation reports all missing fields."""
        poi_data = {
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is False
        assert "place_id" in result.missing_fields
        assert "name" in result.missing_fields
        assert "lat" in result.missing_fields
        assert "lng" in result.missing_fields
        assert "maps_url" in result.missing_fields

    def test_validate_poi_with_flat_coordinates(self) -> None:
        """Test validation works with flat lat/lng fields."""
        poi_data = {
            "place_id": "test123",
            "name": "Test Place",
            "lat": 48.8584,
            "lng": 2.2945,
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is True

    def test_validate_poi_boundary_lat_values(self) -> None:
        """Test validation accepts boundary latitude values."""
        # Test lat = 90
        poi_data = {
            "place_id": "test123",
            "name": "North Pole",
            "coordinates": {"lat": 90.0, "lng": 0.0},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is True

        # Test lat = -90
        poi_data["coordinates"]["lat"] = -90.0
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is True

    def test_validate_poi_boundary_lng_values(self) -> None:
        """Test validation accepts boundary longitude values."""
        # Test lng = 180
        poi_data = {
            "place_id": "test123",
            "name": "Date Line",
            "coordinates": {"lat": 0.0, "lng": 180.0},
            "maps_url": "https://maps.google.com/?q=test",
            "confidence": 1.0,
        }
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is True

        # Test lng = -180
        poi_data["coordinates"]["lng"] = -180.0
        result = self.service.validate_poi(poi_data)
        assert result.is_valid is True


class TestGooglePlaceValidatorServiceParsing:
    """Tests for Google API response parsing."""

    def setup_method(self) -> None:
        """Set up test fixtures."""
        self.service = GooglePlaceValidatorService(api_key="test_key")

    def test_parse_price_level_free(self) -> None:
        """Test parsing FREE price level."""
        result = self.service._parse_price_level("PRICE_LEVEL_FREE")
        assert result == PriceLevel.FREE

    def test_parse_price_level_inexpensive(self) -> None:
        """Test parsing INEXPENSIVE price level."""
        result = self.service._parse_price_level("PRICE_LEVEL_INEXPENSIVE")
        assert result == PriceLevel.INEXPENSIVE

    def test_parse_price_level_moderate(self) -> None:
        """Test parsing MODERATE price level."""
        result = self.service._parse_price_level("PRICE_LEVEL_MODERATE")
        assert result == PriceLevel.MODERATE

    def test_parse_price_level_expensive(self) -> None:
        """Test parsing EXPENSIVE price level."""
        result = self.service._parse_price_level("PRICE_LEVEL_EXPENSIVE")
        assert result == PriceLevel.EXPENSIVE

    def test_parse_price_level_very_expensive(self) -> None:
        """Test parsing VERY_EXPENSIVE price level."""
        result = self.service._parse_price_level("PRICE_LEVEL_VERY_EXPENSIVE")
        assert result == PriceLevel.VERY_EXPENSIVE

    def test_parse_price_level_none(self) -> None:
        """Test parsing None price level."""
        result = self.service._parse_price_level(None)
        assert result is None

    def test_parse_price_level_unknown(self) -> None:
        """Test parsing unknown price level."""
        result = self.service._parse_price_level("UNKNOWN_LEVEL")
        assert result is None

    def test_parse_opening_hours_none(self) -> None:
        """Test parsing None opening hours."""
        result = self.service._parse_opening_hours(None)
        assert result is None

    def test_parse_opening_hours_basic(self) -> None:
        """Test parsing basic opening hours."""
        hours_data = {
            "openNow": True,
            "periods": [
                {
                    "open": {"day": 1, "time": "0900"},
                    "close": {"day": 1, "time": "1700"},
                }
            ],
            "weekdayDescriptions": ["Monday: 9:00 AM – 5:00 PM"],
        }
        result = self.service._parse_opening_hours(hours_data)
        assert result is not None
        assert result.is_open is True
        assert len(result.periods) == 1
        assert result.weekday_text == ["Monday: 9:00 AM – 5:00 PM"]

    def test_parse_photos_none(self) -> None:
        """Test parsing None photos."""
        result = self.service._parse_photos(None)
        assert result is None

    def test_parse_photos_basic(self) -> None:
        """Test parsing basic photos."""
        photos_data = [
            {"name": "places/123/photos/abc"},
            {"name": "places/123/photos/def"},
        ]
        result = self.service._parse_photos(photos_data)
        assert result is not None
        assert len(result) == 2
        assert "places/123/photos/abc" in result

    def test_parse_photos_empty_names(self) -> None:
        """Test parsing photos with empty names."""
        photos_data = [
            {"name": ""},
            {"name": "places/123/photos/abc"},
        ]
        result = self.service._parse_photos(photos_data)
        assert result is not None
        assert len(result) == 1

    def test_parse_place_to_poi_valid(self) -> None:
        """Test parsing valid place data to POI."""
        place_data = {
            "id": "ChIJD7fiBh9u5kcRYJSMaMOCCwQ",
            "displayName": {"text": "Eiffel Tower"},
            "location": {"latitude": 48.8584, "longitude": 2.2945},
            "googleMapsUri": "https://maps.google.com/?cid=123",
            "formattedAddress": "Champ de Mars, Paris",
            "types": ["tourist_attraction", "landmark"],
        }
        result = self.service._parse_place_to_poi(place_data)
        assert result is not None
        assert result.place_id == "ChIJD7fiBh9u5kcRYJSMaMOCCwQ"
        assert result.name == "Eiffel Tower"
        assert result.coordinates.lat == 48.8584
        assert result.coordinates.lng == 2.2945
        assert result.address == "Champ de Mars, Paris"

    def test_parse_place_to_poi_missing_id(self) -> None:
        """Test parsing place data without id returns None."""
        place_data = {
            "displayName": {"text": "Eiffel Tower"},
            "location": {"latitude": 48.8584, "longitude": 2.2945},
            "googleMapsUri": "https://maps.google.com/?cid=123",
        }
        result = self.service._parse_place_to_poi(place_data)
        assert result is None

    def test_parse_place_to_poi_missing_name(self) -> None:
        """Test parsing place data without name returns None."""
        place_data = {
            "id": "test123",
            "location": {"latitude": 48.8584, "longitude": 2.2945},
            "googleMapsUri": "https://maps.google.com/?cid=123",
        }
        result = self.service._parse_place_to_poi(place_data)
        assert result is None

    def test_parse_place_to_poi_missing_location(self) -> None:
        """Test parsing place data without location returns None."""
        place_data = {
            "id": "test123",
            "displayName": {"text": "Test Place"},
            "googleMapsUri": "https://maps.google.com/?cid=123",
        }
        result = self.service._parse_place_to_poi(place_data)
        assert result is None


class TestGooglePlaceValidatorServiceHeaders:
    """Tests for API header generation."""

    def setup_method(self) -> None:
        """Set up test fixtures."""
        self.service = GooglePlaceValidatorService(api_key="test_api_key_123")

    def test_get_headers_contains_api_key(self) -> None:
        """Test that headers contain the API key."""
        headers = self.service._get_headers()
        assert "X-Goog-Api-Key" in headers
        assert headers["X-Goog-Api-Key"] == "test_api_key_123"

    def test_get_headers_contains_content_type(self) -> None:
        """Test that headers contain content type."""
        headers = self.service._get_headers()
        assert "Content-Type" in headers
        assert headers["Content-Type"] == "application/json"


class TestGooglePlaceValidatorServiceGetPlaceDetails:
    """Tests for get_place_details method."""

    def setup_method(self) -> None:
        """Set up test fixtures."""
        self.service = GooglePlaceValidatorService(api_key="test_key")

    @pytest.mark.asyncio
    async def test_get_place_details_empty_place_id(self) -> None:
        """Test that empty place_id raises ValueError."""
        with pytest.raises(ValueError, match="place_id cannot be empty"):
            await self.service.get_place_details("")

    @pytest.mark.asyncio
    async def test_get_place_details_none_place_id(self) -> None:
        """Test that None place_id raises ValueError."""
        with pytest.raises(ValueError, match="place_id cannot be empty"):
            await self.service.get_place_details(None)  # type: ignore
