"""Cache service module.

Provides caching functionality using Redis for storing POI data
and other cacheable responses.

Requirements: 2.5, 7.5, 7.6
"""

from .service import CacheService, RedisCacheService

__all__ = [
    "CacheService",
    "RedisCacheService",
]
