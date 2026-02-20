'use client';

/**
 * Itinerary Result - Shows the generated itinerary from backend
 */

import type { Itinerary } from '@/types';

interface ItineraryResultProps {
  itinerary: Itinerary;
  onViewMap?: () => void;
}

export function ItineraryResult({ itinerary, onViewMap }: ItineraryResultProps) {
  const distanceKm = (itinerary.route.total_distance / 1000).toFixed(1);
  const durationMin = Math.round(itinerary.route.total_duration / 60);
  const isMultiDay = itinerary.days && itinerary.days.length > 1;

  const transportEmoji = {
    walking: '🚶',
    driving: '🚗',
    transit: '🚇',
  }[itinerary.transport_mode];

  return (
    <div className="rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-amber-500/30 overflow-hidden">
      {/* Success header */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-3 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 8L7 11L12 5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">Your itinerary is ready!</h3>
            <p className="text-xs text-amber-400/80">{itinerary.city}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-zinc-700/50 border-b border-zinc-700/50">
        <div className="p-3 text-center">
          <div className="text-xl font-semibold text-amber-400">{itinerary.pois.length}</div>
          <div className="text-xs text-zinc-500">Stops</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xl font-semibold text-white">{distanceKm}<span className="text-sm text-zinc-500 ml-0.5">km</span></div>
          <div className="text-xs text-zinc-500">Distance</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xl font-semibold text-white flex items-center justify-center gap-1">
            {transportEmoji}
            {isMultiDay ? itinerary.total_days : durationMin}
            <span className="text-sm text-zinc-500">{isMultiDay ? 'days' : 'min'}</span>
          </div>
          <div className="text-xs text-zinc-500">{isMultiDay ? 'Duration' : 'Time'}</div>
        </div>
      </div>

      {/* POI list preview */}
      <div className="p-4">
        <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Your Route
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {itinerary.route.ordered_pois.slice(0, 6).map((poi, index) => (
            <div key={poi.place_id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50">
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{poi.name}</p>
                {poi.types?.[0] && (
                  <p className="text-xs text-zinc-500 capitalize">{poi.types[0]}</p>
                )}
              </div>
            </div>
          ))}
          {itinerary.route.ordered_pois.length > 6 && (
            <p className="text-xs text-zinc-500 text-center py-2">
              +{itinerary.route.ordered_pois.length - 6} more stops
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-zinc-700/50 space-y-2">
        <button
          onClick={onViewMap}
          className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1C5.24 1 3 3.24 3 6C3 9.75 8 15 8 15C8 15 13 9.75 13 6C13 3.24 10.76 1 8 1Z" fill="currentColor"/>
          </svg>
          View on Map
        </button>
        
        {itinerary.google_maps_url && (
          <a
            href={itinerary.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-lg bg-[#4285F4] hover:bg-[#3367D6] text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1C5.24 1 3 3.24 3 6C3 9.75 8 15 8 15C8 15 13 9.75 13 6C13 3.24 10.76 1 8 1ZM8 8C6.9 8 6 7.1 6 6C6 4.9 6.9 4 8 4C9.1 4 10 4.9 10 6C10 7.1 9.1 8 8 8Z"/>
            </svg>
            Open in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
