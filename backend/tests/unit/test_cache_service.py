"""Unit tests for the cache service.

Tests the CacheService abstract class and RedisCacheService implementation.

Requirements: 2.5, 7.5, 7.6
"""

import pytest

from app.services.cache import CacheService, RedisCacheService


class TestCacheKeyGeneration:
    """Tests for the build_poi_key static method."""

    def test_build_poi_key_basic(self) -> None:
        """Test basic POI key generation."""
        key = CacheService.build_poi_key("Paris", "ChIJD7fiBh9u5kcRYJSMaMOCCwQ")
        assert key == "poi:paris:ChIJD7fiBh9u5kcRYJSMaMOCCwQ"

    def test_build_poi_key_lowercase_city(self) -> None:
        """Test that city name is lowercased."""
        key = CacheService.build_poi_key("NEW YORK", "abc123")
        assert key == "poi:new york:abc123"

    def test_build_poi_key_mixed_case_city(self) -> None:
        """Test mixed case city name is lowercased."""
        key = CacheService.build_poi_key("San Francisco", "xyz789")
        assert key == "poi:san francisco:xyz789"

    def test_build_poi_key_preserves_place_id_case(self) -> None:
        """Test that place_id case is preserved."""
        key = CacheService.build_poi_key("london", "ChIJdd4hrwug2EcRmSrV3Vo6llI")
        assert key == "poi:london:ChIJdd4hrwug2EcRmSrV3Vo6llI"

    def test_build_poi_key_empty_city(self) -> None:
        """Test key generation with empty city."""
        key = CacheService.build_poi_key("", "place123")
        assert key == "poi::place123"

    def test_build_poi_key_special_characters(self) -> None:
        """Test key generation with special characters in city name."""
        key = CacheService.build_poi_key("São Paulo", "place456")
        assert key == "poi:são paulo:place456"


class TestRedisCacheServiceInit:
    """Tests for RedisCacheService initialization."""

    def test_default_initialization(self) -> None:
        """Test default initialization values."""
        cache = RedisCacheService()
        assert cache._redis_url == "redis://localhost:6379"
        assert cache._default_ttl == 3600
        assert cache._client is None

    def test_custom_initialization(self) -> None:
        """Test custom initialization values."""
        cache = RedisCacheService(
            redis_url="redis://custom:6380",
            default_ttl=7200,
        )
        assert cache._redis_url == "redis://custom:6380"
        assert cache._default_ttl == 7200

    def test_default_ttl_property(self) -> None:
        """Test default_ttl property."""
        cache = RedisCacheService(default_ttl=1800)
        assert cache.default_ttl == 1800


class TestRedisCacheServiceBuildKey:
    """Tests for build_poi_key via RedisCacheService."""

    def test_inherited_build_poi_key(self) -> None:
        """Test that RedisCacheService inherits build_poi_key."""
        key = RedisCacheService.build_poi_key("Tokyo", "place789")
        assert key == "poi:tokyo:place789"

    def test_instance_build_poi_key(self) -> None:
        """Test build_poi_key can be called on instance."""
        cache = RedisCacheService()
        key = cache.build_poi_key("Berlin", "placeABC")
        assert key == "poi:berlin:placeABC"


class TestCacheKeyFormat:
    """Tests for cache key format consistency."""

    def test_key_format_structure(self) -> None:
        """Test that key follows poi:{city}:{place_id} format."""
        key = CacheService.build_poi_key("amsterdam", "place123")
        parts = key.split(":")
        assert len(parts) == 3
        assert parts[0] == "poi"
        assert parts[1] == "amsterdam"
        assert parts[2] == "place123"

    def test_same_inputs_produce_same_key(self) -> None:
        """Test that same inputs always produce the same key."""
        key1 = CacheService.build_poi_key("Rome", "placeXYZ")
        key2 = CacheService.build_poi_key("Rome", "placeXYZ")
        assert key1 == key2

    def test_different_cities_produce_different_keys(self) -> None:
        """Test that different cities produce different keys."""
        key1 = CacheService.build_poi_key("Rome", "place123")
        key2 = CacheService.build_poi_key("Milan", "place123")
        assert key1 != key2

    def test_different_place_ids_produce_different_keys(self) -> None:
        """Test that different place_ids produce different keys."""
        key1 = CacheService.build_poi_key("Rome", "place123")
        key2 = CacheService.build_poi_key("Rome", "place456")
        assert key1 != key2

    def test_case_insensitive_city_matching(self) -> None:
        """Test that city matching is case-insensitive."""
        key1 = CacheService.build_poi_key("PARIS", "place123")
        key2 = CacheService.build_poi_key("paris", "place123")
        key3 = CacheService.build_poi_key("Paris", "place123")
        assert key1 == key2 == key3
