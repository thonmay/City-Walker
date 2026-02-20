"""Wikipedia/Wikimedia API service for free POI images and descriptions.

This service provides:
- Images from Wikimedia Commons (completely free, 90M+ images)
- Short descriptions from Wikipedia
- Works great for famous landmarks
- Fallback to Wikimedia Commons category search

No API key required. Rate limit: be respectful (1 req/sec is fine).
"""

from dataclasses import dataclass
from typing import Optional
import httpx


@dataclass
class WikipediaPlace:
    """Place data enriched from Wikipedia/Wikimedia."""
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    wikipedia_url: Optional[str] = None


class WikipediaService:
    """Wikipedia/Wikimedia API client for POI enrichment.
    
    Uses:
    - Wikipedia API for descriptions and page images
    - Wikimedia Commons for multiple images
    - Completely free, no API key needed
    
    Optimized for speed:
    - Short timeout (5s)
    - Parallel fetching
    """

    WIKIPEDIA_API = "https://en.wikipedia.org/api/rest_v1"
    WIKIPEDIA_ACTION_API = "https://en.wikipedia.org/w/api.php"
    COMMONS_API = "https://commons.wikimedia.org/w/api.php"
    
    # Shared headers for all requests
    HEADERS = {
        "User-Agent": "CityWalker/1.0 (https://citywalker.app; contact@citywalker.app)",
        "Accept": "application/json",
    }

    def __init__(self) -> None:
        self._timeout = 5.0

    async def close(self) -> None:
        pass

    async def get_images_for_landmark(self, name: str, city: str, count: int = 3) -> list[str]:
        """Get multiple images for a landmark from Wikipedia + Wikimedia Commons.
        
        Returns up to `count` images (default 3).
        Fetches from Wikipedia and Commons in parallel for speed.
        """
        import asyncio
        
        images: list[str] = []
        
        try:
            async with httpx.AsyncClient(timeout=self._timeout, headers=self.HEADERS) as client:
                # Fetch from Wikipedia and Commons in parallel
                wiki_task = self._get_wikipedia_image(client, name, city)
                commons_task = self._get_commons_images(client, name, city, count)
                
                wiki_image, commons_images = await asyncio.gather(
                    wiki_task, commons_task, return_exceptions=True
                )
                
                # Add Wikipedia image first (usually best quality)
                if isinstance(wiki_image, str) and wiki_image:
                    images.append(wiki_image)
                
                # Add Commons images (dedupe)
                if isinstance(commons_images, list):
                    for img in commons_images:
                        if img and img not in images and len(images) < count:
                            images.append(img)
                
                return images[:count]
        except Exception:
            return images

    async def _get_wikipedia_image(self, client: httpx.AsyncClient, name: str, city: str) -> Optional[str]:
        """Get main image from Wikipedia."""
        try:
            params = {
                "action": "query",
                "format": "json",
                "generator": "search",
                "gsrsearch": f"{name} {city}",
                "gsrlimit": 1,
                "prop": "pageimages",
                "piprop": "thumbnail",
                "pithumbsize": 800,
            }
            
            response = await client.get(self.WIKIPEDIA_ACTION_API, params=params)
            response.raise_for_status()
            data = response.json()
            
            pages = data.get("query", {}).get("pages", {})
            if pages:
                page = next(iter(pages.values()))
                if page.get("thumbnail"):
                    return page["thumbnail"].get("source")
            return None
        except Exception:
            return None

    async def _get_commons_images(self, client: httpx.AsyncClient, name: str, city: str, count: int) -> list[str]:
        """Get images from Wikimedia Commons."""
        images: list[str] = []
        
        try:
            params = {
                "action": "query",
                "format": "json",
                "generator": "search",
                "gsrsearch": f"{name} {city}",
                "gsrnamespace": 6,  # File namespace - critical!
                "gsrlimit": count + 2,  # Request extra to filter
                "prop": "imageinfo",
                "iiprop": "url|mime",
                "iiurlwidth": 800,
            }
            
            response = await client.get(self.COMMONS_API, params=params)
            response.raise_for_status()
            data = response.json()
            
            pages = data.get("query", {}).get("pages", {})
            if pages:
                for page in pages.values():
                    imageinfo = page.get("imageinfo", [{}])[0]
                    mime = imageinfo.get("mime", "")
                    # Only include actual images (not SVG, PDF)
                    if mime.startswith("image/") and "svg" not in mime:
                        url = imageinfo.get("thumburl") or imageinfo.get("url")
                        if url and url not in images:
                            images.append(url)
                            if len(images) >= count:
                                break
            return images
        except Exception:
            return images

    async def get_image_for_landmark(self, name: str, city: str) -> Optional[str]:
        """Quick method to get a single image URL for a landmark.
        
        For backwards compatibility. Use get_images_for_landmark for multiple.
        """
        images = await self.get_images_for_landmark(name, city, count=1)
        return images[0] if images else None

    async def search_place(self, name: str, city: str) -> Optional[WikipediaPlace]:
        """Search Wikipedia for a place and get its image + description."""
        try:
            async with httpx.AsyncClient(timeout=self._timeout, headers=self.HEADERS) as client:
                params = {
                    "action": "query",
                    "format": "json",
                    "generator": "search",
                    "gsrsearch": f"{name} {city}",
                    "gsrlimit": 1,
                    "prop": "pageimages|extracts|info",
                    "piprop": "thumbnail",
                    "pithumbsize": 800,
                    "exintro": True,
                    "explaintext": True,
                    "exsentences": 2,
                    "inprop": "url",
                }
                
                response = await client.get(self.WIKIPEDIA_ACTION_API, params=params)
                response.raise_for_status()
                data = response.json()
                
                pages = data.get("query", {}).get("pages", {})
                if not pages:
                    return None
                
                page = next(iter(pages.values()))
                if page.get("missing"):
                    return None
                
                thumbnail_url = None
                if page.get("thumbnail"):
                    thumbnail_url = page["thumbnail"].get("source")
                
                return WikipediaPlace(
                    title=page.get("title", name),
                    description=page.get("extract"),
                    image_url=thumbnail_url,
                    thumbnail_url=thumbnail_url,
                    wikipedia_url=page.get("fullurl"),
                )
            
        except Exception as e:
            print(f"Wikipedia search error for {name}: {e}")
            return None
