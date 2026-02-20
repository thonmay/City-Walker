'use client';

/**
 * RouteSummaryPanel - Side panel showing itinerary details
 * Displays POI list, day tabs for multi-day trips, and stats.
 */

import type { Itinerary, POI } from '@/types';

interface RouteSummaryPanelProps {
  itinerary: Itinerary;
  selectedPoi: POI | null;
  onPoiSelect: (poi: POI | null) => void;
  selectedDay: number;
  onDayChange: (day: number) => void;
}

export function RouteSummaryPanel({
  itinerary,
  selectedPoi,
  onPoiSelect,
  selectedDay,
  onDayChange,
}: RouteSummaryPanelProps) {
  const isMultiDay =
    itinerary.total_days > 1 &&
    itinerary.days != null &&
    itinerary.days.length > 0;

  const displayPois =
    isMultiDay && itinerary.days
      ? itinerary.days.find(d => d.day_number === selectedDay)?.pois ?? []
      : itinerary.route?.ordered_pois ?? [];

  const currentDayPlan =
    isMultiDay && itinerary.days
      ? itinerary.days.find(d => d.day_number === selectedDay) ?? null
      : null;

  const stats = currentDayPlan
    ? {
        stops: currentDayPlan.pois.length,
        distance: currentDayPlan.total_walking_km ?? 0,
        duration: currentDayPlan.route?.total_duration ?? 0,
        theme: currentDayPlan.theme,
      }
    : {
        stops: itinerary.route?.ordered_pois?.length ?? 0,
        distance: (itinerary.route?.total_distance ?? 0) / 1000,
        duration: itinerary.route?.total_duration ?? 0,
        theme: null,
      };

  return (
    <div className="absolute top-20 right-4 bottom-4 w-80 z-1000">
      <div className="h-full bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-zinc-200 shrink-0">
          <h2 className="font-semibold text-zinc-900 text-lg">
            {isMultiDay ? `${itinerary.total_days}-Day Trip` : 'Your Route'}
          </h2>
          <p className="text-sm text-zinc-500">
            {stats.stops} stops · {stats.distance.toFixed(1)} km · ~{Math.round(stats.duration / 60)} min
          </p>

          {stats.theme ? (
            <p className="text-xs text-amber-600 font-medium mt-1">📍 {stats.theme}</p>
          ) : null}

          {itinerary.starting_location ? (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <span>🏨</span> From {itinerary.starting_location}
            </p>
          ) : null}

          {itinerary.ai_explanation && !isMultiDay ? (
            <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{itinerary.ai_explanation}</p>
          ) : null}
        </div>

        {/* Day Tabs for Multi-Day */}
        {isMultiDay && itinerary.days ? (
          <div className="px-3 py-2 border-b border-zinc-100 shrink-0 overflow-x-auto">
            <div className="flex gap-1">
              {itinerary.days.map(day => (
                <button
                  key={day.day_number}
                  onClick={() => onDayChange(day.day_number)}
                  className={`flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[60px] transition-all ${
                    selectedDay === day.day_number
                      ? 'bg-amber-500 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  <span className="text-[10px] opacity-80">Day</span>
                  <span className="text-sm font-bold">{day.day_number}</span>
                  <span className={`text-[10px] ${selectedDay === day.day_number ? 'text-white/80' : 'text-zinc-400'}`}>
                    {day.pois.length} stops
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* POI List */}
        <div className="flex-1 overflow-y-auto">
          {displayPois.map((poi, index) => {
            const isSelected = selectedPoi?.place_id === poi.place_id;
            return (
              <button
                key={poi.place_id}
                onClick={() => onPoiSelect(isSelected ? null : poi)}
                className={`w-full p-3 border-b border-zinc-100 text-left transition-colors ${
                  isSelected ? 'bg-amber-50' : 'hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isSelected ? 'bg-amber-500 text-black' : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-zinc-900 text-sm truncate">{poi.name}</h4>
                    {poi.types?.[0] ? (
                      <p className="text-xs text-zinc-500 capitalize">{poi.types[0].replace(/_/g, ' ')}</p>
                    ) : null}
                  </div>
                  {poi.photos?.[0] ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={poi.photos[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {/* Google Maps Button */}
        {itinerary.google_maps_url ? (
          <div className="p-3 border-t border-zinc-200 shrink-0">
            <a
              href={itinerary.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-xl transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1C6.24 1 4 3.24 4 6C4 10 9 17 9 17C9 17 14 10 14 6C14 3.24 11.76 1 9 1ZM9 8C7.9 8 7 7.1 7 6C7 4.9 7.9 4 9 4C10.1 4 11 4.9 11 6C11 7.1 10.1 8 9 8Z" fill="currentColor" />
              </svg>
              Open in Google Maps
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
