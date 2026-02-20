"""Geographic utility functions.

This module provides shared geographic calculations used across the application.
Consolidates the haversine distance calculation that was previously duplicated
in multiple services.
"""

import math


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points on Earth.
    
    Uses the Haversine formula to calculate the shortest distance over the
    Earth's surface between two points specified by latitude and longitude.
    
    Args:
        lat1: Latitude of the first point in degrees
        lng1: Longitude of the first point in degrees
        lat2: Latitude of the second point in degrees
        lng2: Longitude of the second point in degrees
        
    Returns:
        Distance in kilometers
        
    Example:
        >>> haversine_distance(48.8566, 2.3522, 51.5074, -0.1278)  # Paris to London
        343.56  # approximately
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2)
    
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
