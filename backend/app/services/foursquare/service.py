"""Foursquare Places API service for enriched POI data.

This service provides:
- Ratings and popularity scores
- Photos
- Better opening hours data
- Tips/reviews summary

Uses Foursquare API v2 with Client ID/Secret authentication.
Falls back gracefully if Foursquare is unavailable or quota exceeded.
"""

import os
from dataclasses import dataclass
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()


@dataclass
class FoursquarePlace:
    """Enriched place data from Foursquare."""
    fsq_id: str
    name: str
    lat: float
    lng: float
    rating: Optional[float] = None  # 0-10 scale
    photos: Optional[list[str]] = None
    opening_hours: Optional[list[str]] = None
    price_level: Optional[int] = None  # 1-4
    categories: Optional[list[str]] = None
    popularity: Optional[float] = None  # 0-1
    tips_count: Optional[int] = None
    address: Optional[str] = None


class FoursquareService:
    """Foursquare Places API client for POI enrichment.
    
    Uses v2 API with Client ID/Secret authentication.
    """

    BASE_URL = "https://api.foursquare.com/v2"
    API_VERSION = "20240101"  # Foursquare requires a version date

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ) -> None:
        self._client_id = client_id or os.getenv("FOURSQUARE_CLIENT_ID")
        self._client_secret = client_secret or os.getenv("FOURSQUARE_CLIENT_SECRET")
        self._client: Optional[httpx.AsyncClient] = None
        self._enabled = bool(self._client_id and self._client_secret)
        
        if self._enabled:
            print(f"Foursquare integration enabled (client_id: {self._client_id[:8]}...)")
        else:
            print("Foursquare integration disabled - missing CLIENT_ID or CLIENT_SECRET")

    @property
    def is_enabled(self) -> bool:
        """Check if Foursquare integration is available."""
        return self._enabled

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=15.0,
                headers={"Accept": "application/json"}
            )
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _auth_params(self) -> dict:
        """Get authentication parameters for API calls."""
        return {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "v": self.API_VERSION,
        }

    async def search_place(
        self, name: str, city: str, lat: Optional[float] = None, lng: Optional[float] = None
    ) -> Optional[FoursquarePlace]:
        """Search for a place by name and location."""
        if not self._enabled:
            return None

        try:
            client = await self._get_client()
            
            params = {
                **self._auth_params(),
                "query": name,
                "limit": 1,
            }
            
            # Use coordinates if available, otherwise use city name
            if lat and lng:
                params["ll"] = f"{lat},{lng}"
                params["radius"] = 1000
            else:
                params["near"] = city

            response = await client.get(f"{self.BASE_URL}/venues/search", params=params)
            
            if response.status_code == 401:
                print("Foursquare credentials invalid")
                self._enabled = False
                return None
            
            if response.status_code == 429:
                print("Foursquare rate limit exceeded")
                return None
                
            response.raise_for_status()
            data = response.json()

            venues = data.get("response", {}).get("venues", [])
            if not venues:
                return None

            venue = venues[0]
            
            # Get more details including photos
            return await self._get_venue_details(venue["id"])

        except httpx.HTTPStatusError as e:
            print(f"Foursquare HTTP error: {e.response.status_code}")
            return None
        except Exception as e:
            print(f"Foursquare search error: {e}")
            return None

    async def _get_venue_details(self, venue_id: str) -> Optional[FoursquarePlace]:
        """Get detailed venue information including photos."""
        try:
            client = await self._get_client()
            
            response = await client.get(
                f"{self.BASE_URL}/venues/{venue_id}",
                params=self._auth_params()
            )
            response.raise_for_status()
            data = response.json()
            
            venue = data.get("response", {}).get("venue", {})
            if not venue:
                return None

            return self._parse_venue(venue)

        except Exception as e:
            print(f"Foursquare venue details error: {e}")
            return None

    async def get_place_details(self, fsq_id: str) -> Optional[FoursquarePlace]:
        """Get detailed information for a specific place."""
        if not self._enabled:
            return None
        return await self._get_venue_details(fsq_id)

    async def get_place_photos(self, fsq_id: str, limit: int = 3) -> list[str]:
        """Get photos for a place."""
        if not self._enabled:
            return []

        try:
            client = await self._get_client()
            
            params = {
                **self._auth_params(),
                "limit": limit,
            }
            response = await client.get(
                f"{self.BASE_URL}/venues/{fsq_id}/photos",
                params=params
            )
            response.raise_for_status()
            
            data = response.json()
            photos = data.get("response", {}).get("photos", {}).get("items", [])
            
            return [
                f"{p.get('prefix')}original{p.get('suffix')}"
                for p in photos
                if p.get("prefix") and p.get("suffix")
            ]

        except Exception as e:
            print(f"Foursquare photos error: {e}")
            return []

    def _parse_venue(self, venue: dict) -> FoursquarePlace:
        """Parse Foursquare venue response into FoursquarePlace."""
        location = venue.get("location", {})
        
        # Parse photos
        photos = []
        photos_data = venue.get("photos", {}).get("groups", [])
        for group in photos_data:
            for photo in group.get("items", [])[:5]:
                if photo.get("prefix") and photo.get("suffix"):
                    photos.append(f"{photo['prefix']}300x300{photo['suffix']}")

        # Also check bestPhoto
        best_photo = venue.get("bestPhoto", {})
        if best_photo.get("prefix") and best_photo.get("suffix"):
            photo_url = f"{best_photo['prefix']}300x300{best_photo['suffix']}"
            if photo_url not in photos:
                photos.insert(0, photo_url)

        # Parse opening hours
        hours_data = venue.get("hours", {})
        opening_hours = None
        if hours_data.get("status"):
            opening_hours = [hours_data["status"]]
        elif hours_data.get("timeframes"):
            opening_hours = self._format_timeframes(hours_data["timeframes"])

        # Parse categories
        categories = [
            cat.get("name") for cat in venue.get("categories", [])
            if cat.get("name")
        ]

        # Parse address
        address_parts = location.get("formattedAddress", [])
        address = ", ".join(address_parts[:2]) if address_parts else None

        # Rating (0-10 scale)
        rating = venue.get("rating")

        return FoursquarePlace(
            fsq_id=venue.get("id", ""),
            name=venue.get("name", ""),
            lat=location.get("lat", 0),
            lng=location.get("lng", 0),
            rating=rating,
            photos=photos if photos else None,
            opening_hours=opening_hours,
            price_level=venue.get("price", {}).get("tier"),
            categories=categories if categories else None,
            popularity=venue.get("stats", {}).get("tipCount", 0) / 100 if venue.get("stats") else None,
            tips_count=venue.get("stats", {}).get("tipCount"),
            address=address,
        )

    def _format_timeframes(self, timeframes: list[dict]) -> list[str]:
        """Format timeframes into readable strings."""
        formatted = []
        for tf in timeframes[:4]:
            days = tf.get("days", "")
            times = tf.get("open", [])
            if times:
                time_str = ", ".join([f"{t.get('start', '')}-{t.get('end', '')}" for t in times])
                formatted.append(f"{days}: {time_str}")
        return formatted if formatted else None
