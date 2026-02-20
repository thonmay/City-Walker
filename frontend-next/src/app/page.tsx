'use client';

/**
 * City Walker - Main Page
 *
 * Flow:
 * 1. User enters a city → backend discovers POIs
 * 2. POIs appear on map, user accepts/rejects
 * 3. User generates optimized walking route
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { POIPreviewCard } from '@/components/POIPreviewCard';
import { RouteSummaryPanel } from '@/components/RouteSummaryPanel';
import { TransportModeSelector, type TransportMode } from '@/components/TransportModeSelector';
import { TripDurationSelector } from '@/components/DayTabs';
import { HomeBaseInput, type HomeBase } from '@/components/HomeBaseInput';
import { createRouteFromSelection, discoverPois, discoverFood } from '@/lib/api';
import { DEFAULT_CENTER, MAX_SINGLE_DAY_POIS } from '@/lib/config';
import type { Itinerary, POI, Coordinates } from '@/types';

const MapView = dynamic(
  () => import('@/components/Map').then(mod => ({ default: mod.Map })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
        <div className="text-zinc-400">Loading map...</div>
      </div>
    ),
  }
);

interface GeocodedPOI extends POI {
  isLoading?: boolean;
  specialty?: string;
}

/** Convert raw backend POI to typed GeocodedPOI */
function toGeocodedPOI(
  poi: Partial<GeocodedPOI> & Record<string, unknown>,
  fallbackType = 'landmark'
): GeocodedPOI {
  return {
    place_id: poi.place_id ?? '',
    name: poi.name ?? '',
    coordinates: poi.coordinates ?? { lat: 0, lng: 0 },
    maps_url: poi.maps_url ?? '',
    opening_hours: poi.opening_hours ?? null,
    price_level: poi.price_level ?? null,
    confidence: (poi.confidence as number) ?? 0.9,
    photos: Array.isArray(poi.photos) && poi.photos.length > 0 ? poi.photos : undefined,
    address: poi.address as string | undefined,
    types: (poi.types as string[]) ?? [fallbackType],
    visit_duration_minutes: (poi.visit_duration_minutes as number) ?? 60,
    why_visit: poi.why_visit as string | undefined,
    specialty: poi.specialty as string | undefined,
  };
}

export default function Home() {
  // --- State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState('');
  const [discoveredPois, setDiscoveredPois] = useState<GeocodedPOI[]>([]);
  const [currentCity, setCurrentCity] = useState('');
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [acceptedPois, setAcceptedPois] = useState<Set<string>>(new Set());
  const [rejectedPois, setRejectedPois] = useState<Set<string>>(new Set());
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>('walking');
  const [tripDays, setTripDays] = useState(1);
  const [showTripSettings, setShowTripSettings] = useState(false);
  const [homeBase, setHomeBase] = useState<HomeBase | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Derived state (memoized) ---
  const acceptedCount = acceptedPois.size;
  const maxPois = tripDays > 1 ? Infinity : MAX_SINGLE_DAY_POIS;
  const hasDiscoveredPois = discoveredPois.length > 0;

  const visiblePois = useMemo(
    () => discoveredPois.filter(p => !rejectedPois.has(p.place_id)),
    [discoveredPois, rejectedPois]
  );

  const isMultiDay = Boolean(
    itinerary && itinerary.total_days > 1 && itinerary.days && itinerary.days.length > 0
  );

  const currentDayData = useMemo(
    () => (isMultiDay ? itinerary?.days?.find(d => d.day_number === selectedDay) ?? null : null),
    [isMultiDay, itinerary, selectedDay]
  );

  const mapItinerary = useMemo(() => {
    if (!itinerary) return null;
    if (!isMultiDay || !currentDayData) return itinerary;

    const dayRoute = currentDayData.route;
    const effectiveRoute = dayRoute ?? {
      ordered_pois: currentDayData.pois,
      polyline: '',
      total_distance: 0,
      total_duration: 0,
      transport_mode: itinerary.route?.transport_mode ?? 'walking',
      legs: [],
      is_round_trip: false,
    };

    return { ...itinerary, route: effectiveRoute, pois: currentDayData.pois };
  }, [itinerary, isMultiDay, currentDayData]);

  // --- Handlers (functional setState for stable refs) ---
  const handleAccept = useCallback(
    (poiId: string) => {
      setAcceptedPois(prev => {
        if (prev.size >= maxPois) return prev; // guard
        const next = new Set(prev);
        next.add(poiId);
        return next;
      });
      setRejectedPois(prev => {
        if (!prev.has(poiId)) return prev;
        const next = new Set(prev);
        next.delete(poiId);
        return next;
      });
      setError(null);
    },
    [maxPois]
  );

  const handleReject = useCallback((poiId: string) => {
    setRejectedPois(prev => new Set(prev).add(poiId));
    setAcceptedPois(prev => {
      if (!prev.has(poiId)) return prev;
      const next = new Set(prev);
      next.delete(poiId);
      return next;
    });
    setSelectedPoi(prev => (prev?.place_id === poiId ? null : prev));
  }, []);

  const handleNewTrip = useCallback(() => {
    setItinerary(null);
    setSelectedPoi(null);
    setDiscoveredPois([]);
    setAcceptedPois(new Set());
    setRejectedPois(new Set());
    setSearchQuery('');
    setError(null);
    setCurrentCity('');
  }, []);

  // --- Discovery ---
  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const city = searchQuery.trim();
      if (!city || isStreaming) return;

      setError(null);
      setIsStreaming(true);
      setStreamingProgress('Discovering landmarks...');
      setDiscoveredPois([]);
      setAcceptedPois(new Set());
      setRejectedPois(new Set());
      setSelectedPoi(null);
      setItinerary(null);
      setCurrentCity(city);
      setShowTripSettings(false);

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        const data = await discoverPois(city, Math.max(15, tripDays * 8), signal);

        if (data.city_center) {
          setMapCenter({ lat: data.city_center.lat, lng: data.city_center.lng });
        }

        let landmarkPois: GeocodedPOI[] = [];
        if (data.pois && data.pois.length > 0) {
          landmarkPois = data.pois.map(p => toGeocodedPOI(p as Partial<GeocodedPOI> & Record<string, unknown>));
          setDiscoveredPois(landmarkPois);
        }

        // Phase 2: cafes & restaurants in parallel
        setStreamingProgress('Finding local favorites...');
        const [cafes, restaurants] = await Promise.all([
          discoverFood(city, 'cafes', 5, signal),
          discoverFood(city, 'restaurants', 5, signal),
        ]);

        const existingNames = new Set(landmarkPois.map(p => p.name.toLowerCase()));
        const foodPois: GeocodedPOI[] = [];

        for (const result of [cafes, restaurants]) {
          if (result.success && result.pois) {
            for (const poi of result.pois) {
              const name = (poi.name as string)?.toLowerCase();
              if (name && !existingNames.has(name)) {
                foodPois.push(toGeocodedPOI(poi as Partial<GeocodedPOI> & Record<string, unknown>, 'cafe'));
                existingNames.add(name);
              }
            }
          }
        }

        if (foodPois.length > 0) {
          setDiscoveredPois(prev => [...prev, ...foodPois]);
        }

        if (landmarkPois.length === 0 && foodPois.length === 0) {
          setError('No places found. Try a different city.');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Discovery error:', err);
        setError(err instanceof Error ? err.message : 'Failed to discover places');
      } finally {
        setIsStreaming(false);
        setStreamingProgress('');
      }
    },
    [searchQuery, isStreaming, tripDays]
  );

  const handleGenerateRoute = useCallback(async () => {
    if (acceptedPois.size === 0) {
      setError('Select at least one place to create a route.');
      return;
    }

    setIsGeneratingRoute(true);
    setError(null);

    const selected = discoveredPois.filter(p => acceptedPois.has(p.place_id));
    const result = await createRouteFromSelection(selected, transportMode, homeBase, tripDays);

    setIsGeneratingRoute(false);

    if (result.success && result.itinerary) {
      setItinerary(result.itinerary);
      setSelectedPoi(null);
    } else {
      setError(result.error ?? 'Failed to create route');
    }
  }, [acceptedPois, discoveredPois, transportMode, homeBase, tripDays]);

  // --- Debug (dev only) ---
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!isMultiDay || !currentDayData) return;
    console.log(`[Day ${selectedDay}]`, {
      hasRoute: !!currentDayData.route,
      polyline: currentDayData.route?.polyline?.length ?? 0,
      pois: currentDayData.pois?.length,
    });
  }, [isMultiDay, currentDayData, selectedDay]);

  // --- Render ---
  return (
    <div className="h-screen w-full bg-zinc-100 overflow-hidden relative">
      {/* Map */}
      <main className="absolute inset-0">
        <MapView
          itinerary={mapItinerary}
          selectedPoi={selectedPoi}
          onPinClick={setSelectedPoi}
          suggestedPois={itinerary ? [] : visiblePois}
          acceptedPois={acceptedPois}
          center={mapCenter}
          selectedDay={selectedDay}
        />
      </main>

      {/* Top Bar */}
      <div className="absolute top-4 left-4 right-4 z-1000 flex items-center gap-3">
        <div className="bg-white rounded-xl px-4 py-2.5 shadow-lg border border-zinc-200 flex items-center gap-2 shrink-0">
          <span className="text-2xl">🚶</span>
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-zinc-900">City</span>
            <span className="text-amber-500">Walker</span>
          </span>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Enter a city to explore (e.g., Paris, Tokyo, Rome)"
              className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 pr-12 text-zinc-900 placeholder-zinc-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-300 rounded-lg transition-colors"
            >
              {isStreaming ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-black">
                  <path d="M17 17L13 13M15 8.5C15 12.0899 12.0899 15 8.5 15C4.91015 15 2 12.0899 2 8.5C2 4.91015 4.91015 2 8.5 2C12.0899 2 15 4.91015 15 8.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </form>

        <button
          onClick={() => setShowTripSettings(s => !s)}
          className={`bg-white border border-zinc-200 rounded-xl px-3 py-2.5 shadow-lg transition-all shrink-0 ${
            showTripSettings ? 'ring-2 ring-amber-500/50' : ''
          }`}
          title="Trip Settings"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-zinc-600">
            <path d="M10 6V10M10 14H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        {(hasDiscoveredPois || itinerary) ? (
          <button
            onClick={handleNewTrip}
            className="bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 shadow-lg transition-colors shrink-0"
          >
            New Trip
          </button>
        ) : null}
      </div>

      {/* Trip Settings Panel */}
      {showTripSettings && !hasDiscoveredPois ? (
        <div className="absolute top-20 left-4 z-999 animate-in slide-in-from-top-2 duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 p-4 w-80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-900">Trip Settings</h3>
              <button onClick={() => setShowTripSettings(false)} className="text-zinc-400 hover:text-zinc-600">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2 block">
                How are you getting around?
              </label>
              <TransportModeSelector value={transportMode} onChange={setTransportMode} />
            </div>
            <div className="mb-4">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2 block">
                How long is your trip?
              </label>
              <TripDurationSelector value={tripDays} onChange={setTripDays} />
            </div>
            <div className="mb-4">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2 block">
                Where are you staying?
              </label>
              <HomeBaseInput value={homeBase} onChange={setHomeBase} city={currentCity} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Streaming Progress */}
      {isStreaming ? (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-1000">
          <div className="bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-sm">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm font-medium">{streamingProgress || 'Discovering places...'}</span>
          </div>
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-1000">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="M10 6V10M10 14H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {/* POI Card — Discovery */}
      {selectedPoi && !itinerary ? (
        <div className="absolute bottom-16 left-4 z-1001">
          <POIPreviewCard
            poi={selectedPoi}
            onClose={() => setSelectedPoi(null)}
            onAccept={() => handleAccept(selectedPoi.place_id)}
            onReject={() => handleReject(selectedPoi.place_id)}
            isAccepted={acceptedPois.has(selectedPoi.place_id)}
            isRejected={rejectedPois.has(selectedPoi.place_id)}
            showActions
          />
        </div>
      ) : null}

      {/* POI Card — Itinerary */}
      {selectedPoi && itinerary ? (
        <div className="absolute bottom-6 left-4 z-1001">
          <POIPreviewCard
            poi={selectedPoi}
            visitOrder={(itinerary.route?.ordered_pois?.findIndex(p => p.place_id === selectedPoi.place_id) ?? -1) + 1}
            onClose={() => setSelectedPoi(null)}
          />
        </div>
      ) : null}

      {/* Generate Route Button */}
      {hasDiscoveredPois && !itinerary ? (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-1000">
          <button
            onClick={handleGenerateRoute}
            disabled={isGeneratingRoute || acceptedCount === 0}
            className={`
              group relative overflow-hidden px-8 py-4 rounded-2xl
              font-semibold text-lg tracking-tight transition-all duration-300 ease-out
              flex items-center gap-3
              ${acceptedCount > 0
                ? 'bg-linear-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-[0_8px_32px_-4px_rgba(245,158,11,0.5)] hover:shadow-[0_12px_40px_-4px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
              }
            `}
          >
            {acceptedCount > 0 && !isGeneratingRoute ? (
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-linear-to-r from-transparent via-white/20 to-transparent" />
            ) : null}

            {isGeneratingRoute ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="relative">Creating your route...</span>
              </>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`relative ${acceptedCount > 0 ? 'group-hover:rotate-12 transition-transform duration-300' : ''}`}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8L14 12L12 16L10 12L12 8Z" fill="currentColor" />
                  <path d="M8 12L12 10L16 12L12 14L8 12Z" fill="currentColor" fillOpacity="0.5" />
                </svg>
                <span className="relative">
                  {acceptedCount > 0
                    ? `Create Route · ${acceptedCount} place${acceptedCount !== 1 ? 's' : ''}`
                    : 'Select places to create route'}
                </span>
                {acceptedCount > 0 ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                ) : null}
              </>
            )}
          </button>
        </div>
      ) : null}

      {/* Route Summary */}
      {itinerary ? (
        <RouteSummaryPanel
          itinerary={itinerary}
          selectedPoi={selectedPoi}
          onPoiSelect={setSelectedPoi}
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
        />
      ) : null}
    </div>
  );
}
