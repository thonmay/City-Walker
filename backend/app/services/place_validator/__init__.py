"""Place Validator service module.

Provides Google Places API integration for searching and validating
points of interest (POIs).

Requirements: 2.1, 2.6
- 2.1: Retrieve all POI data exclusively from Google Places API
- 2.6: Fetch Place Details from Google Places API when user selects a POI
"""

from .service import (
    PlaceValidatorService,
    OpenStreetMapValidatorService,
    GooglePlaceValidatorService,  # Alias for compatibility
    ValidationResult,
    StructuredQuery,
)

__all__ = [
    "PlaceValidatorService",
    "OpenStreetMapValidatorService",
    "GooglePlaceValidatorService",
    "ValidationResult",
    "StructuredQuery",
]
