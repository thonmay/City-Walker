'use client';

/**
 * POI Preview Card - Shows place details when marker is clicked
 * Rich UI with Wikipedia images, opening hours, and Google Maps link
 */

import type { POI } from '@/types';
import { ImageCarousel } from './ImageCarousel';

interface POIPreviewCardProps {
  poi: POI;
  visitOrder?: number;
  onClose: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  isAccepted?: boolean;
  isRejected?: boolean;
  showActions?: boolean;
}

/**
 * Parse OSM opening hours format into readable lines
 */
function parseOpeningHours(hoursText: string): string[] {
  if (!hoursText || hoursText.length > 200) return [];

  const dayMap: Record<string, string> = {
    'Mo': 'Mon', 'Tu': 'Tue', 'We': 'Wed', 'Th': 'Thu',
    'Fr': 'Fri', 'Sa': 'Sat', 'Su': 'Sun', 'PH': 'Holidays'
  };

  const parts = hoursText.split(';').map(p => p.trim()).filter(Boolean);
  const result: string[] = [];

  for (const part of parts.slice(0, 3)) {
    if (part.includes('off') || part.includes('closed')) continue;

    const match = part.match(/^([A-Za-z,-]+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
    if (match) {
      let days = match[1];
      for (const [abbr, full] of Object.entries(dayMap)) {
        days = days.replace(new RegExp(abbr, 'g'), full);
      }
      result.push(`${days}: ${match[2]} - ${match[3]}`);
    } else if (part.length < 40) {
      result.push(part);
    }
  }

  return result;
}

export function POIPreviewCard({
  poi,
  visitOrder,
  onClose,
  onAccept,
  onReject,
  isAccepted,
  isRejected,
  showActions = false,
}: POIPreviewCardProps) {

  const hasOpeningHours = poi.opening_hours?.weekday_text && poi.opening_hours.weekday_text.length > 0;
  const openingHoursLines = hasOpeningHours
    ? parseOpeningHours(poi.opening_hours!.weekday_text[0])
    : [];

  const hasPhotos = poi.photos && poi.photos.length > 0;
  const photos = hasPhotos ? poi.photos! : [];

  // Get emoji for place type
  const getPlaceEmoji = (type: string): string => {
    const emojis: Record<string, string> = {
      museum: '🏛️',
      cafe: '☕',
      landmark: '🏰',
      church: '⛪',
      park: '🌳',
      restaurant: '🍽️',
      bar: '🍸',
      viewpoint: '👀',
      market: '🛒',
      gallery: '🎨',
      palace: '🏰',
    };
    return emojis[type] || '📍';
  };

  const placeEmoji = getPlaceEmoji(poi.types?.[0] || 'landmark');

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden border border-zinc-200 animate-scale-in">
      {/* Hero Image Carousel or Placeholder */}
      <div className="relative h-44 overflow-hidden bg-zinc-100">
        {hasPhotos ? (
          <>
            <ImageCarousel
              images={photos}
              alt={poi.name}
              className="w-full h-full"
            />
          </>
        ) : (
          /* Placeholder with emoji */
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
            <span className="text-6xl">{placeEmoji}</span>
          </div>
        )}

        {/* Visit order badge */}
        {visitOrder !== undefined && (
          <div className="absolute top-3 left-3 w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-base shadow-lg">
            {visitOrder}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="mb-3">
          <h3 className="font-semibold text-zinc-900 text-lg leading-tight">
            {poi.name}
          </h3>
          {/* Show type and visit duration instead of full address */}
          <div className="flex items-center gap-2 mt-1">
            {poi.types?.[0] && (
              <span className="text-sm text-zinc-500 capitalize">
                {poi.types[0].replace(/_/g, ' ')}
              </span>
            )}
            {poi.visit_duration_minutes && (
              <>
                <span className="text-zinc-300">•</span>
                <span className="text-sm text-zinc-500">
                  ~{poi.visit_duration_minutes >= 60 
                    ? `${Math.round(poi.visit_duration_minutes / 60)}h` 
                    : `${poi.visit_duration_minutes}min`}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Why visit */}
        {poi.why_visit && (
          <p className="text-sm text-zinc-600 mb-3">{poi.why_visit}</p>
        )}

        {/* Specialty (for cafes/restaurants) */}
        {poi.specialty && (
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-amber-600 font-medium">Try:</span>
            <span className="text-zinc-700">{poi.specialty}</span>
          </div>
        )}

        {/* Opening Hours */}
        {openingHoursLines.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-400 mt-0.5 shrink-0">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div className="text-sm space-y-0.5">
                {openingHoursLines.map((line, i) => (
                  <p key={i} className="text-zinc-600">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Accept/Reject Actions */}
        {showActions && !isAccepted && !isRejected && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={onAccept}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Add to Trip
            </button>
            <button
              onClick={onReject}
              className="py-2.5 px-4 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-medium rounded-lg transition-colors"
            >
              Skip
            </button>
          </div>
        )}

        {/* Accepted state */}
        {showActions && isAccepted && (
          <div className="mb-3 py-2.5 bg-green-100 text-green-700 font-medium rounded-lg text-center">
            ✓ Added to Trip
          </div>
        )}

        {/* Google Maps Button */}
        <a
          href={poi.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1C5.24 1 3 3.24 3 6C3 9.75 8 15 8 15C8 15 13 9.75 13 6C13 3.24 10.76 1 8 1ZM8 8C6.9 8 6 7.1 6 6C6 4.9 6.9 4 8 4C9.1 4 10 4.9 10 6C10 7.1 9.1 8 8 8Z" fill="currentColor" />
          </svg>
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
