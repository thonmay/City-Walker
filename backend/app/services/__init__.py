"""City Walker Services.

This module contains all service layer components including:
- Cache service for Redis-based caching
- AI reasoning service for natural language processing (Gemini)
- Place validator service for geocoding and validation
- Route optimizer service for route calculation
- Foursquare service for POI enrichment (ratings, photos, hours)
"""

from .cache import CacheService, RedisCacheService
from .ai_reasoning import AIReasoningService, GeminiReasoningService, RankedPOI, LandmarkSuggestion
from .place_validator import (
    PlaceValidatorService,
    OpenStreetMapValidatorService,
    GooglePlaceValidatorService,
    ValidationResult,
    StructuredQuery,
)
from .route_optimizer import (
    RouteOptimizerService,
    OSRMRouteOptimizerService,
    GoogleRouteOptimizerService,
    DistanceMatrix,
)
from .foursquare import FoursquareService

__all__ = [
    # Cache service
    "CacheService",
    "RedisCacheService",
    # AI reasoning service
    "AIReasoningService",
    "GeminiReasoningService",
    "RankedPOI",
    "LandmarkSuggestion",
    # Place validator service
    "PlaceValidatorService",
    "OpenStreetMapValidatorService",
    "GooglePlaceValidatorService",
    "ValidationResult",
    "StructuredQuery",
    # Route optimizer service
    "RouteOptimizerService",
    "OSRMRouteOptimizerService",
    "GoogleRouteOptimizerService",
    "DistanceMatrix",
    # Foursquare service
    "FoursquareService",
]
