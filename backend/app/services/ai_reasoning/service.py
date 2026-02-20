"""AI Reasoning service implementation using Google Gemini.

This module provides AI-powered features using Google's Gemini API
with the Gemma 3 27B model for:
- Interpreting messy user input into structured queries
- Suggesting famous landmarks for any city (AI knows what's famous)
- Ranking POIs by relevance to user interests
- Clustering nearby POIs
- Generating route explanations

Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.6, 3.7
- AI SHALL NOT generate coordinates, opening hours, or prices (3.6, 3.7)
- AI CAN suggest landmark NAMES which are then validated against real data
"""

import asyncio
import json
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from google import genai
from dotenv import load_dotenv

from app.models import POI, Route
from app.services.place_validator import StructuredQuery
from app.utils.geo import haversine_distance

# Load environment variables
load_dotenv()


@dataclass
class RankedPOI:
    """A POI with relevance ranking information."""
    poi: POI
    relevance_score: float
    reasoning: str


@dataclass
class LandmarkSuggestion:
    """AI-suggested landmark (name only, no coordinates)."""
    name: str
    category: str
    why_visit: str
    visit_duration_hours: float = 1.0  # Default 1 hour
    specialty: str = ""  # For restaurants/cafes: what they're known for


class AIReasoningService(ABC):
    """Abstract base class for AI reasoning services.

    Defines the interface for AI-powered features including input
    interpretation, POI ranking, clustering, and route explanation.

    IMPORTANT: AI SHALL NOT generate factual data like coordinates,
    opening hours, or prices (Requirements 3.6, 3.7).
    AI CAN suggest landmark names which must be validated.
    """

    @abstractmethod
    async def interpret_user_input(
        self, location: str, interests: list[str] | None
    ) -> StructuredQuery:
        """Convert messy user input into structured query."""
        pass

    @abstractmethod
    async def suggest_landmarks(
        self, city: str, interests: list[str] | None
    ) -> list[LandmarkSuggestion]:
        """Suggest famous landmarks for a city (names only, no coordinates)."""
        pass

    @abstractmethod
    async def rank_pois(
        self, pois: list[POI], interests: list[str]
    ) -> list[RankedPOI]:
        """Rank POIs by relevance to user interests."""
        pass

    @abstractmethod
    async def cluster_nearby_pois(
        self, pois: list[POI]
    ) -> list[list[POI]]:
        """Group nearby POIs into clusters."""
        pass

    @abstractmethod
    async def explain_route(self, route: Route) -> str:
        """Generate human-readable explanation for route logic."""
        pass


class GeminiReasoningService(AIReasoningService):
    """Google Gemini implementation of the AI reasoning service."""

    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,  # Will use env var or default
        timeout_seconds: float = 30.0,  # 30 second timeout
    ) -> None:
        self._api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self._api_key:
            raise ValueError("GEMINI_API_KEY not provided")
        
        self._client = genai.Client(api_key=self._api_key)
        # Allow model override via env var, default to faster 4B model
        self._model_name = model_name or os.getenv("GEMINI_MODEL", "gemma-3-4b-it")
        self._timeout = timeout_seconds
        print(f"[AI] Using model: {self._model_name}")

    async def _generate(self, prompt: str, timeout: float | None = None) -> str:
        """Generate content using Gemini API with timeout.
        
        Args:
            prompt: The prompt to send to the model
            timeout: Optional timeout override (uses default if not specified)
            
        Returns:
            Generated text response
            
        Raises:
            asyncio.TimeoutError: If the request takes too long
            Exception: For other API errors
        """
        import asyncio
        
        effective_timeout = timeout or self._timeout
        
        try:
            # Wrap the API call with a timeout
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self._model_name,
                    contents=prompt,
                ),
                timeout=effective_timeout
            )
            return response.text.strip() if response.text else ""
        except asyncio.TimeoutError:
            print(f"[AI] Timeout after {effective_timeout}s waiting for Gemini response")
            raise
        except Exception as e:
            print(f"[AI] Error generating content: {e}")
            raise

    def _extract_json(self, text: str) -> str:
        """Extract JSON from response (handle markdown code blocks)."""
        if "```json" in text:
            return text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            return text.split("```")[1].split("```")[0].strip()
        return text

    def _normalize_landmark_name(self, name: str) -> str:
        """Normalize landmark names for better geocoding.
        
        Handles common AI output issues:
        - CamelCase names (BrandenburgGate -> Brandenburg Gate)
        - "The" prefix removal
        - Parenthetical alternatives removal
        - Extra whitespace cleanup
        """
        import re
        
        if not name:
            return ""
        
        # Remove "The " prefix
        if name.startswith("The "):
            name = name[4:]
        
        # Remove parenthetical alternatives like "Brandenburger Tor (Brandenburg Gate)"
        if "(" in name:
            name = name.split("(")[0].strip()
        
        # Split CamelCase into separate words
        # "BrandenburgGate" -> "Brandenburg Gate"
        # "EastSideGallery" -> "East Side Gallery"
        # But preserve things like "DDR" or "UNESCO"
        name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
        
        # Also handle cases like "ReichstagBuilding" -> "Reichstag Building"
        name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', name)
        
        # Clean up multiple spaces
        name = ' '.join(name.split())
        
        return name.strip()

    async def interpret_user_input(
        self, location: str, interests: list[str] | None
    ) -> StructuredQuery:
        """Convert messy user input into structured query using Gemini."""
        interests_str = ", ".join(interests) if interests else "general sightseeing"
        
        prompt = f"""Parse this travel request into a structured query.

User's location input: "{location}"
User's interests: {interests_str}

Respond ONLY with valid JSON:
{{"city": "city name", "area": "neighborhood or null", "poi_types": ["types"], "keywords": ["keywords"]}}

Rules:
- Extract city name from location
- Include area/neighborhood if mentioned
- Suggest POI types based on interests
- Do NOT include coordinates or addresses
"""

        try:
            text = await self._generate(prompt)
            data = json.loads(self._extract_json(text))
            return StructuredQuery(
                city=data.get("city", location),
                area=data.get("area"),
                poi_types=data.get("poi_types", []),
                keywords=data.get("keywords", []),
            )
        except Exception:
            return StructuredQuery(city=location, keywords=interests or [])

    async def suggest_landmarks(
        self, 
        city: str, 
        interests: list[str] | None,
        transport_mode: str = "walking",
        time_constraint: str | None = None,
    ) -> list[LandmarkSuggestion]:
        """Suggest famous landmarks for a city using AI knowledge.
        
        AI suggests NAMES only - coordinates must be looked up separately.
        This allows AI to know what's famous without generating fake data.
        """
        interests_str = ", ".join(interests) if interests else "sightseeing, landmarks, culture"
        
        # Determine number of suggestions based on time
        num_suggestions = self._get_suggestion_count(time_constraint)
        
        # Simplified prompt for faster response
        prompt = f"""Suggest {num_suggestions} famous tourist places in {city}.

Interests: {interests_str}
Transport: {transport_mode}

Return ONLY a JSON array:
[{{"name": "Place Name", "category": "landmark|church|museum|park|palace|square|market|viewpoint", "why_visit": "One sentence", "visit_duration_hours": 1.5}}]

Rules:
- Only places WITHIN {city} city limits
- Use simple, searchable names (no "The", no parentheses)
- Start with most famous places
- No coordinates or addresses"""

        try:
            text = await self._generate(prompt, timeout=20.0)  # Reduced timeout
            data = json.loads(self._extract_json(text))
            
            suggestions = []
            seen_names = set()
            
            for item in data[:num_suggestions]:
                name = item.get("name", "").strip()
                
                # Clean up the name
                name = self._normalize_landmark_name(name)
                
                if not name or name.lower() in seen_names:
                    continue
                
                # Parse visit duration (default to 1 hour if not provided)
                visit_duration = item.get("visit_duration_hours", 1.0)
                try:
                    visit_duration = float(visit_duration)
                except (ValueError, TypeError):
                    visit_duration = 1.0
                    
                suggestions.append(LandmarkSuggestion(
                    name=name,
                    category=item.get("category", "attraction"),
                    why_visit=item.get("why_visit", ""),
                    visit_duration_hours=visit_duration,
                ))
                seen_names.add(name.lower())
            
            print(f"[AI] Successfully got {len(suggestions)} landmark suggestions")
            return suggestions
        except asyncio.TimeoutError:
            print(f"[AI] Timeout getting landmarks for {city}, returning fallback")
            return self._get_fallback_landmarks(city)
        except Exception as e:
            print(f"[AI] Landmark suggestion error: {e}")
            return self._get_fallback_landmarks(city)
    
    def _get_fallback_landmarks(self, city: str) -> list[LandmarkSuggestion]:
        """Return common landmark suggestions when AI is unavailable.
        
        These are generic suggestions that work for most cities.
        The geocoding step will filter out any that don't exist.
        """
        # Common landmark patterns that exist in most cities
        fallback_patterns = [
            LandmarkSuggestion(name=f"{city} Cathedral", category="church", why_visit="Historic cathedral", visit_duration_hours=1.0),
            LandmarkSuggestion(name=f"{city} Castle", category="landmark", why_visit="Historic castle", visit_duration_hours=1.5),
            LandmarkSuggestion(name=f"Old Town {city}", category="landmark", why_visit="Historic old town", visit_duration_hours=2.0),
            LandmarkSuggestion(name=f"{city} City Hall", category="landmark", why_visit="Historic city hall", visit_duration_hours=0.5),
            LandmarkSuggestion(name=f"{city} Main Square", category="square", why_visit="Central square", visit_duration_hours=0.5),
            LandmarkSuggestion(name=f"{city} Museum", category="museum", why_visit="City museum", visit_duration_hours=1.5),
            LandmarkSuggestion(name=f"{city} Park", category="park", why_visit="City park", visit_duration_hours=1.0),
            LandmarkSuggestion(name=f"{city} Market", category="market", why_visit="Local market", visit_duration_hours=1.0),
        ]
        return fallback_patterns

    def _get_transport_constraints(self, transport_mode: str) -> str:
        """Get transport-specific constraints for AI prompt."""
        if transport_mode == "walking":
            return """
WALKING CONSTRAINTS (CRITICAL):
- ONLY suggest places WITHIN THE CITY LIMITS - no exceptions
- Stay within ~3km walking radius of city center
- NEVER suggest places from other cities (e.g., Versailles is NOT in Paris, it's a separate city)
- NEVER suggest places from other countries
- Exclude day-trip destinations entirely
- Prioritize walkable neighborhoods with clustered attractions
- Maximum realistic walking: 8-10km total per day with stops"""
        
        elif transport_mode == "transit":
            return """
TRANSIT CONSTRAINTS:
- ONLY suggest places WITHIN THE CITY LIMITS or its immediate metro area
- Can include attractions reachable by metro/bus (up to 30-40 min transit)
- NEVER suggest places from other cities or countries
- Avoid places requiring multiple transfers or long suburban trains
- For multi-day trips: can include ONE day-trip destination but CLEARLY LABEL IT as a day trip"""
        
        else:  # driving
            return """
DRIVING CONSTRAINTS:
- Primarily suggest places WITHIN THE CITY LIMITS
- Can include nearby suburban attractions (within 30 min drive)
- NEVER suggest places from other countries
- For multi-day trips: can include ONE regional day trip but CLEARLY LABEL IT
- Mix city center (park and walk) with drivable attractions"""

    def _get_time_constraints(self, time_constraint: str | None, transport_mode: str) -> str:
        """Get time-specific constraints for AI prompt."""
        if time_constraint == "6h":
            return """
HALF-DAY (6 HOURS) CONSTRAINTS:
- Suggest 4-5 places maximum
- Avoid major museums that need 3+ hours (Louvre, Vatican Museums)
- Focus on outdoor landmarks, viewpoints, and quick visits
- Include a lunch/coffee break spot
- Total visit time + travel should fit in 6 hours"""
        
        elif time_constraint == "day":
            return """
FULL DAY CONSTRAINTS:
- Suggest 6-8 places
- Can include ONE major attraction (2-3 hours)
- Balance: morning activity + lunch + afternoon exploration
- Include mix of quick stops and longer visits
- Consider energy levels: heavier activities in morning"""
        
        elif time_constraint == "2days":
            return """
2-DAY TRIP CONSTRAINTS:
- Suggest 10-12 places total
- Organize by geographic zones (Day 1: Area A, Day 2: Area B)
- Can include ONE major museum per day
- Day 2 can include slightly further attractions
- Include evening activity suggestions"""
        
        elif time_constraint == "3days":
            return """
3-DAY TRIP CONSTRAINTS:
- Suggest 12-15 places total
- Day 1-2: City center zones
- Day 3: Can include a half-day trip or outer neighborhood
- Include variety: museums, outdoor, food, culture
- Pace it: don't exhaust tourists"""
        
        elif time_constraint == "5days":
            return f"""
5-DAY TRIP CONSTRAINTS:
- Suggest 18-22 places total
- Days 1-3: Core city attractions by zone
- Days 4-5: {"Day trips and regional attractions" if transport_mode != "walking" else "Outer neighborhoods and hidden gems"}
- Include rest day activities (parks, cafes, markets)
- Mix famous landmarks with local favorites
- Can include ONE full-day trip (if not walking)"""
        
        else:
            return """
FLEXIBLE TIME:
- Suggest 8-10 places
- Prioritize must-see attractions
- Include mix of quick and longer visits"""

    def _get_suggestion_count(self, time_constraint: str | None) -> int:
        """Get number of suggestions based on time constraint."""
        counts = {
            "6h": 10,
            "day": 18,
            "2days": 25,
            "3days": 35,
            "5days": 50,
        }
        return counts.get(time_constraint, 18)  # Default to 18 for big cities

    async def rank_pois(
        self, pois: list[POI], interests: list[str]
    ) -> list[RankedPOI]:
        """Rank POIs by relevance to user interests using Gemini."""
        if not pois:
            return []
        
        if not interests:
            return [RankedPOI(poi=poi, relevance_score=0.5, reasoning="No interests") for poi in pois]

        poi_summaries = [f"{i}: {poi.name} ({', '.join(poi.types or [])})" for i, poi in enumerate(pois)]
        
        prompt = f"""Rank places by relevance to interests: {', '.join(interests)}

Places:
{chr(10).join(poi_summaries)}

Respond with JSON array: [{{"index": 0, "score": 0.8, "reasoning": "why"}}]
Score 0-1, higher = more relevant."""

        try:
            text = await self._generate(prompt)
            rankings = json.loads(self._extract_json(text))
            
            ranked = []
            for item in rankings:
                idx = item.get("index", 0)
                if 0 <= idx < len(pois):
                    ranked.append(RankedPOI(
                        poi=pois[idx],
                        relevance_score=min(1.0, max(0.0, float(item.get("score", 0.5)))),
                        reasoning=item.get("reasoning", ""),
                    ))
            
            ranked_indices = {item.get("index") for item in rankings}
            for i, poi in enumerate(pois):
                if i not in ranked_indices:
                    ranked.append(RankedPOI(poi=poi, relevance_score=0.5, reasoning="Not evaluated"))
            
            ranked.sort(key=lambda x: x.relevance_score, reverse=True)
            return ranked
        except Exception:
            return [RankedPOI(poi=poi, relevance_score=0.5, reasoning="Unavailable") for poi in pois]

    async def cluster_nearby_pois(self, pois: list[POI]) -> list[list[POI]]:
        """Group nearby POIs into clusters (within 1km)."""
        if not pois:
            return []
        if len(pois) == 1:
            return [pois]

        clusters: list[list[POI]] = []
        assigned = set()

        for i, poi in enumerate(pois):
            if i in assigned:
                continue
            
            cluster = [poi]
            assigned.add(i)
            
            for j, other in enumerate(pois):
                if j in assigned:
                    continue
                
                distance = self._haversine_distance(
                    poi.coordinates.lat, poi.coordinates.lng,
                    other.coordinates.lat, other.coordinates.lng
                )
                
                if distance <= 1.0:
                    cluster.append(other)
                    assigned.add(j)
            
            clusters.append(cluster)

        return clusters

    def _haversine_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points in kilometers."""
        return haversine_distance(lat1, lng1, lat2, lng2)

    async def explain_route(self, route: Route) -> str:
        """Generate human-readable explanation for route logic."""
        if not route.ordered_pois:
            return "No places in this route."

        stops = [f"{i}. {poi.name}" for i, poi in enumerate(route.ordered_pois, 1)]
        duration_mins = route.total_duration // 60
        distance_km = route.total_distance / 1000

        prompt = f"""Write 2-3 sentences explaining this {route.transport_mode.value} route:
{chr(10).join(stops)}
Distance: {distance_km:.1f}km, Time: {duration_mins}min

Be friendly and helpful. No specific times or prices."""

        try:
            return await self._generate(prompt)
        except Exception:
            return f"This {route.transport_mode.value} route covers {len(route.ordered_pois)} stops over {distance_km:.1f}km (~{duration_mins} min)."

    async def suggest_food_and_drinks(
        self,
        city: str,
        category: str = "cafes",  # cafes, restaurants, bars, parks
        limit: int = 10,
    ) -> list[LandmarkSuggestion]:
        """Suggest famous/iconic cafes, restaurants, bars, or parks in a city.
        
        This uses AI knowledge to suggest FAMOUS places that tourists should visit.
        The key difference from random OSM queries:
        - AI knows which places are iconic/historic (Café de Flore, not random Starbucks)
        - AI knows local specialties (croissants in Paris, tapas in Barcelona)
        - Results are validated against OSM/Nominatim to ensure they exist
        
        IMPORTANT: AI suggests NAMES only. Coordinates come from Nominatim.
        This prevents hallucinated locations while leveraging AI's knowledge of fame.
        """
        # Category-specific prompts for better results
        # Normalize category key
        category_key = category if category in ["cafes", "restaurants", "bars", "parks"] else "cafes"
        
        category_prompts = {
            "cafes": f"""Suggest {limit} FAMOUS historic cafes in {city} that tourists should visit.

Return ONLY a JSON array:
[{{"name": "Exact Cafe Name", "category": "cafe", "why_visit": "One sentence about history/fame", "visit_duration_hours": 0.75, "specialty": "What to order"}}]

CRITICAL RULES:
- Only ICONIC/HISTORIC cafes that appear in travel guides
- Places that have been open for decades (not new trendy spots)
- Use the EXACT official name (searchable on Google Maps)
- Include the specialty drink/food they're known for
- NO chain cafes (no Starbucks, Costa, etc.)
- NO permanently closed places
- Only places WITHIN {city} city limits""",

            "restaurants": f"""Suggest {limit} FAMOUS restaurants in {city} known for local cuisine.

Return ONLY a JSON array:
[{{"name": "Exact Restaurant Name", "category": "restaurant", "why_visit": "One sentence about fame/specialty", "visit_duration_hours": 1.5, "specialty": "Signature dish"}}]

CRITICAL RULES:
- Only ICONIC restaurants that locals and tourists both love
- Places known for authentic local cuisine
- Use the EXACT official name (searchable on Google Maps)
- Include their signature dish or specialty
- NO chain restaurants
- NO permanently closed places
- Only places WITHIN {city} city limits""",

            "bars": f"""Suggest {limit} FAMOUS historic bars/pubs in {city}.

Return ONLY a JSON array:
[{{"name": "Exact Bar Name", "category": "bar", "why_visit": "One sentence about history/fame", "visit_duration_hours": 1.0, "specialty": "Signature drink"}}]

CRITICAL RULES:
- Only ICONIC/HISTORIC bars that appear in travel guides
- Places with interesting history or famous patrons
- Use the EXACT official name (searchable on Google Maps)
- NO chain bars or generic pubs
- NO permanently closed places
- Only places WITHIN {city} city limits""",

            "parks": f"""Suggest {limit} FAMOUS parks and gardens in {city}.

Return ONLY a JSON array:
[{{"name": "Exact Park Name", "category": "park", "why_visit": "One sentence about what makes it special", "visit_duration_hours": 1.5, "specialty": "Best feature or activity"}}]

CRITICAL RULES:
- Only NOTABLE parks that tourists should visit
- Include both large parks and hidden garden gems
- Use the EXACT official name (searchable on Google Maps)
- Only places WITHIN {city} city limits""",
        }
        
        prompt = category_prompts.get(category_key, category_prompts["cafes"])
        print(f"[AI] Using prompt for category: {category_key}")
        
        try:
            text = await self._generate(prompt, timeout=15.0)
            data = json.loads(self._extract_json(text))
            
            suggestions = []
            seen_names = set()
            
            for item in data[:limit]:
                name = item.get("name", "").strip()
                
                # Clean up the name (handles CamelCase, "The" prefix, parentheses)
                name = self._normalize_landmark_name(name)
                
                if not name or name.lower() in seen_names:
                    continue
                
                # Parse visit duration
                visit_duration = item.get("visit_duration_hours", 1.0)
                try:
                    visit_duration = float(visit_duration)
                except (ValueError, TypeError):
                    visit_duration = 1.0
                
                suggestions.append(LandmarkSuggestion(
                    name=name,
                    category=item.get("category", category),
                    why_visit=item.get("why_visit", ""),
                    visit_duration_hours=visit_duration,
                    specialty=item.get("specialty", ""),
                ))
                seen_names.add(name.lower())
            
            print(f"[AI] Got {len(suggestions)} {category} suggestions for {city}")
            return suggestions
            
        except asyncio.TimeoutError:
            print(f"[AI] Timeout getting {category} for {city}")
            return []
        except Exception as e:
            print(f"[AI] Error getting {category} suggestions: {e}")
            return []
