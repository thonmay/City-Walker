'use client';

/**
 * Map Component - Leaflet map with animated POI pins and route visualization
 * 
 * OPTIMIZED VERSION:
 * - Animations only play on FIRST appearance (tracked via ref)
 * - Selection changes update marker styles without re-animating
 * - Click zooms IN to selected POI (not out)
 * - Smooth, performant updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { POI, Coordinates, Itinerary } from '@/types';

interface MapProps {
  itinerary?: Itinerary | null;
  selectedPoi?: POI | null;
  onPinClick?: (poi: POI) => void;
  suggestedPois?: POI[];
  acceptedPois?: Set<string>;
  center?: Coordinates;
  selectedDay?: number;
}

// Default center (Paris)
const DEFAULT_CENTER: [number, number] = [48.8566, 2.3522];

// Inject animation styles once
let stylesInjected = false;
function injectAnimationStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = 'citywalker-map-animations';
  style.textContent = `
    @keyframes poiPopIn {
      0% { transform: scale(0); opacity: 0; }
      70% { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
    
    @keyframes routeMarkerPop {
      0% { transform: scale(0); opacity: 0; }
      70% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 1; }
    }
    
    .poi-animate-in {
      animation: poiPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    .route-animate-in {
      animation: routeMarkerPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    .poi-marker-wrap {
      transition: transform 0.15s ease;
    }
    
    .poi-marker-wrap:hover {
      transform: scale(1.12) !important;
    }
    
    .leaflet-tooltip.poi-tooltip {
      background: rgba(24, 24, 27, 0.9);
      border: none;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      padding: 6px 12px;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    .leaflet-tooltip.poi-tooltip::before {
      border-top-color: rgba(24, 24, 27, 0.9);
    }
  `;
  document.head.appendChild(style);
}

// Get emoji for place type
function getPlaceEmoji(type: string): string {
  const emojis: Record<string, string> = {
    museum: '🏛️', cafe: '☕', landmark: '🏰', church: '⛪', park: '🌳',
    restaurant: '🍽️', bar: '🍸', viewpoint: '👀', market: '🛒', gallery: '🎨',
    palace: '🏰', monument: '🗿', square: '🏛️', garden: '🌷', bridge: '🌉',
    tower: '🗼', club: '🎵',
  };
  return emojis[type] || '📍';
}

// Create POI marker HTML (static - no animation class if already shown)
function createPOIMarkerHTML(
  poi: POI,
  isSelected: boolean,
  isAccepted: boolean,
  photoUrl: string | null,
  shouldAnimate: boolean,
  animationDelay: number
): string {
  const size = isSelected ? 62 : 52;
  const borderColor = isAccepted ? '#22c55e' : (isSelected ? '#f59e0b' : 'white');
  const borderWidth = isAccepted || isSelected ? 4 : 3;
  const shadow = isAccepted
    ? '0 4px 16px rgba(34, 197, 94, 0.4)'
    : (isSelected ? '0 4px 20px rgba(245, 158, 11, 0.5)' : '0 4px 14px rgba(0,0,0,0.2)');

  const emoji = getPlaceEmoji(poi.types?.[0] || 'landmark');
  const animClass = shouldAnimate ? 'poi-animate-in' : '';
  const animStyle = shouldAnimate ? `animation-delay:${animationDelay}ms;` : '';

  const innerContent = photoUrl
    ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<span style="font-size:${isSelected ? 26 : 22}px;">${emoji}</span>`;

  const checkmark = isAccepted ? `
    <div style="position:absolute;bottom:-3px;right:-3px;width:22px;height:22px;background:#22c55e;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>` : '';

  return `
    <div class="poi-marker-wrap ${animClass}" style="${animStyle}">
      <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;background:white;border:${borderWidth}px solid ${borderColor};box-shadow:${shadow};cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;">
        ${innerContent}
        ${checkmark}
      </div>
    </div>
  `;
}

// Create route marker HTML
function createRouteMarkerHTML(
  number: number,
  isSelected: boolean,
  shouldAnimate: boolean,
  animationDelay: number
): string {
  const size = isSelected ? 50 : 42;
  const bgColor = isSelected ? '#f59e0b' : 'white';
  const textColor = isSelected ? 'white' : '#18181b';
  const borderColor = isSelected ? '#f59e0b' : '#d4d4d8';
  const shadow = isSelected ? '0 4px 20px rgba(245, 158, 11, 0.5)' : '0 3px 12px rgba(0,0,0,0.15)';

  const animClass = shouldAnimate ? 'route-animate-in' : '';
  const animStyle = shouldAnimate ? `animation-delay:${animationDelay}ms;` : '';

  return `
    <div class="${animClass}" style="${animStyle}">
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${bgColor};border:3px solid ${borderColor};box-shadow:${shadow};cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${isSelected ? 18 : 15}px;color:${textColor};font-family:system-ui,sans-serif;">
        ${number}
      </div>
    </div>
  `;
}

// Decode polyline
function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return [];
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Ramer-Douglas-Peucker polyline simplification for cleaner walking routes
// This removes unnecessary detail from street-level routing for a Google Maps-like appearance
function simplifyPolyline(points: [number, number][], tolerance: number = 0.00015): [number, number][] {
  if (points.length <= 2) return points;

  // Find point with max distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;
  const [startLat, startLng] = points[0];
  const [endLat, endLng] = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const [lat, lng] = points[i];
    // Perpendicular distance from point to line (simplified for small distances)
    const dist = Math.abs(
      (endLng - startLng) * (startLat - lat) - (startLng - lng) * (endLat - startLat)
    ) / Math.sqrt((endLng - startLng) ** 2 + (endLat - startLat) ** 2);

    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance > tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyPolyline(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPolyline(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  // Otherwise just return endpoints
  return [points[0], points[points.length - 1]];
}

export function Map({
  itinerary,
  selectedPoi,
  onPinClick,
  suggestedPois,
  acceptedPois = new Set(),
  center,
  selectedDay = 1
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // Leaflet types are dynamic-import only, using any for refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylinesRef = useRef<any[]>([]);
  const animatedPoisRef = useRef<Set<string>>(new Set()); // Track which POIs have animated
  const lastPoisRef = useRef<string>(''); // Track POI list to detect new POIs
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    injectAnimationStyles();
  }, []);

  // Get stable POI key for comparison
  const getPoisKey = useCallback((pois: POI[] | undefined) => {
    if (!pois) return '';
    return pois.map(p => p.place_id).sort().join(',');
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isClient || !mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      mapInstanceRef.current = L.map(mapRef.current!, {
        center: DEFAULT_CENTER,
        zoom: 13,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
      }).addTo(mapInstanceRef.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);
    };

    initMap();
  }, [isClient]);

  // Update markers when POIs change
  useEffect(() => {
    if (!isClient || !mapInstanceRef.current) return;

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current;

      // Clear polylines
      polylinesRef.current.forEach(line => line.remove());
      polylinesRef.current = [];

      // ITINERARY MODE
      if (itinerary) {
        // Clear discovery markers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(markersRef.current).forEach((m: any) => m.remove());
        markersRef.current = {};

        const pois = itinerary.route?.ordered_pois || itinerary.pois || [];
        // Include selectedDay in key so day switches trigger full redraw
        const itineraryKey = `day${selectedDay}_${pois.map(p => p.place_id).join(',')}`;
        const isNewItinerary = lastPoisRef.current !== itineraryKey;
        lastPoisRef.current = itineraryKey;

        // Debug: Log route data
        if (process.env.NODE_ENV === 'development') {
          console.log('[Map] Itinerary route:', {
            hasRoute: !!itinerary.route,
            hasPolyline: !!itinerary.route?.polyline,
            polylineLength: itinerary.route?.polyline?.length || 0,
            poisCount: pois.length,
            transportMode: itinerary.route?.transport_mode,
            isNewItinerary,
            selectedDay,
          });
        }

        // Draw route line
        const polyline = itinerary.route?.polyline;
        if (polyline && polyline.length > 0) {
          try {
            let points = decodePolyline(polyline);
            
            // Simplify walking routes for cleaner appearance
            if (points.length > 20 && itinerary.route?.transport_mode === 'walking') {
              const simplified = simplifyPolyline(points, 0.0003);
              if (simplified.length >= Math.max(3, points.length * 0.1)) {
                points = simplified;
              }
            }
            
            if (points.length > 0) {
              const shadow = L.polyline(points, { color: '#000', weight: 9, opacity: 0.12, lineCap: 'round', lineJoin: 'round' }).addTo(map);
              polylinesRef.current.push(shadow);
              const main = L.polyline(points, { color: '#f59e0b', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
              polylinesRef.current.push(main);
            }
          } catch (e) {
            console.error('[Map] Polyline decode error:', e);
          }
        } else if (pois.length > 1) {
          // Fallback: draw straight lines between POIs when no polyline available
          const fallbackPoints = pois.map(p => [p.coordinates.lat, p.coordinates.lng] as [number, number]);
          const shadow = L.polyline(fallbackPoints, { color: '#000', weight: 9, opacity: 0.08, lineCap: 'round', lineJoin: 'round', dashArray: '8, 12' }).addTo(map);
          polylinesRef.current.push(shadow);
          const main = L.polyline(fallbackPoints, { color: '#f59e0b', weight: 4, opacity: 0.7, lineCap: 'round', lineJoin: 'round', dashArray: '8, 12' }).addTo(map);
          polylinesRef.current.push(main);
        }

        // Add/update route markers
        pois.forEach((poi, index) => {
          const isSelected = selectedPoi?.place_id === poi.place_id;
          const shouldAnimate = isNewItinerary && !animatedPoisRef.current.has(poi.place_id);
          const animDelay = shouldAnimate ? index * 60 : 0;

          if (shouldAnimate) animatedPoisRef.current.add(poi.place_id);

          const existingMarker = markersRef.current[poi.place_id];
          const icon = L.divIcon({
            className: '',
            html: createRouteMarkerHTML(index + 1, isSelected, shouldAnimate, animDelay),
            iconSize: [50, 50],
            iconAnchor: [25, 25],
          });

          if (existingMarker) {
            existingMarker.setIcon(icon);
            existingMarker.setZIndexOffset(isSelected ? 1000 : index);
          } else {
            const marker = L.marker([poi.coordinates.lat, poi.coordinates.lng], {
              icon,
              zIndexOffset: isSelected ? 1000 : index
            });
            marker.on('click', () => onPinClick?.(poi));
            marker.addTo(map);
            markersRef.current[poi.place_id] = marker;
          }
        });

        // Fit bounds on new itinerary with smooth animation
        if (isNewItinerary && pois.length > 0) {
          const bounds = L.latLngBounds(pois.map(p => [p.coordinates.lat, p.coordinates.lng] as [number, number]));
          map.flyToBounds(bounds, {
            padding: [60, 60],
            maxZoom: 15,
            duration: 1.2,
            easeLinearity: 0.25  // Smooth ease from Vite version
          });
        }
        return;
      }

      // DISCOVERY MODE
      if (suggestedPois && suggestedPois.length > 0) {
        const currentKey = getPoisKey(suggestedPois);
        const isNewBatch = lastPoisRef.current !== currentKey;

        if (isNewBatch) {
          // New batch - clear old markers and reset animation tracking
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.values(markersRef.current).forEach((m: any) => m.remove());
          markersRef.current = {};
          animatedPoisRef.current.clear();
          lastPoisRef.current = currentKey;
        }

        suggestedPois.forEach((poi, index) => {
          if (!poi.coordinates) return;

          const isSelected = selectedPoi?.place_id === poi.place_id;
          const isAccepted = acceptedPois.has(poi.place_id);
          const photoUrl = poi.photos?.[0] || null;

          // Only animate if this POI hasn't been shown yet
          const shouldAnimate = !animatedPoisRef.current.has(poi.place_id);
          const animDelay = shouldAnimate ? index * 80 : 0;

          if (shouldAnimate) animatedPoisRef.current.add(poi.place_id);

          const icon = L.divIcon({
            className: '',
            html: createPOIMarkerHTML(poi, isSelected, isAccepted, photoUrl, shouldAnimate, animDelay),
            iconSize: [62, 62],
            iconAnchor: [31, 31],
          });

          const existingMarker = markersRef.current[poi.place_id];

          if (existingMarker) {
            // Update existing marker (no re-animation)
            existingMarker.setIcon(icon);
            existingMarker.setZIndexOffset(isSelected ? 2000 : (isAccepted ? 1000 : 0));
          } else {
            // New marker with animation
            const marker = L.marker([poi.coordinates.lat, poi.coordinates.lng], {
              icon,
              zIndexOffset: isSelected ? 2000 : (isAccepted ? 1000 : 0),
            });
            marker.bindTooltip(poi.name, { direction: 'top', offset: [0, -32], className: 'poi-tooltip' });
            marker.on('click', () => onPinClick?.(poi));
            marker.addTo(map);
            markersRef.current[poi.place_id] = marker;
          }
        });

        // Only fit bounds on new batch, not on selection changes
        if (isNewBatch) {
          const points = suggestedPois.filter(p => p.coordinates).map(p => [p.coordinates.lat, p.coordinates.lng] as [number, number]);
          if (points.length > 0) {
            const bounds = L.latLngBounds(points);
            // Delay slightly to let pop-in animations start
            setTimeout(() => {
              map.flyToBounds(bounds, {
                padding: [80, 80],
                maxZoom: 14,
                duration: 1.5,
                easeLinearity: 0.25  // Smooth ease from Vite version
              });
            }, 150);
          }
        }
        return;
      }

      // No POIs - clear markers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.values(markersRef.current).forEach((m: any) => m.remove());
      markersRef.current = {};

      if (center) {
        map.flyTo([center.lat, center.lng], 13, { duration: 0.8 });
      }
    };

    updateMarkers();
  }, [isClient, itinerary, selectedPoi, suggestedPois, acceptedPois, center, onPinClick, getPoisKey, selectedDay]);

  // Zoom IN to selected POI (separate effect to avoid marker rebuilding)
  useEffect(() => {
    if (!isClient || !mapInstanceRef.current || !selectedPoi?.coordinates) return;

    // Zoom IN to selected POI - at least zoom 16, never zoom out
    const currentZoom = mapInstanceRef.current.getZoom();
    const targetZoom = Math.max(currentZoom, 16);

    mapInstanceRef.current.flyTo(
      [selectedPoi.coordinates.lat, selectedPoi.coordinates.lng],
      targetZoom,
      {
        duration: 0.8,  // Quick but smooth
        easeLinearity: 0.5  // Faster ease for selection (from Vite version)
      }
    );
  }, [isClient, selectedPoi?.place_id]); // Only trigger on place_id change

  if (!isClient) {
    return (
      <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
        <div className="text-zinc-400">Loading map...</div>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full" />;
}
