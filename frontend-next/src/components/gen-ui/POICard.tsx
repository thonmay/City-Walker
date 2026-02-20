'use client';

/**
 * POI Card - Interactive place suggestion card for Gen UI
 */

interface POICardProps {
  name: string;
  type: string;
  whyVisit: string;
  estimatedMinutes: number;
  onAccept?: () => void;
  onReject?: () => void;
  isAccepted?: boolean;
  isRejected?: boolean;
}

const typeEmojis: Record<string, string> = {
  museum: '🏛️',
  cafe: '☕',
  landmark: '🏰',
  church: '⛪',
  park: '🌳',
  restaurant: '🍽️',
  bar: '🍸',
  viewpoint: '🌅',
  palace: '👑',
  square: '🏛️',
  market: '🛒',
  default: '📍',
};

export function POICard({
  name,
  type,
  whyVisit,
  estimatedMinutes,
  onAccept,
  onReject,
  isAccepted,
  isRejected,
}: POICardProps) {
  const emoji = typeEmojis[type.toLowerCase()] || typeEmojis.default;

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  if (isRejected) {
    return (
      <div className="opacity-50 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="text-lg">{emoji}</span>
          <span className="line-through">{name}</span>
          <span className="text-xs ml-auto">Skipped</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border transition-all duration-300
        ${isAccepted 
          ? 'bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/30' 
          : 'bg-zinc-800/80 border-zinc-700 hover:border-zinc-600'
        }
      `}
    >
      {/* Gradient accent */}
      <div className={`
        absolute top-0 left-0 right-0 h-1 
        ${isAccepted ? 'bg-amber-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}
      `} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center text-xl
            ${isAccepted ? 'bg-amber-500/20' : 'bg-zinc-700'}
          `}>
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold truncate ${isAccepted ? 'text-amber-400' : 'text-white'}`}>
              {name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="capitalize">{type}</span>
              <span>•</span>
              <span className="text-amber-500/80">{formatDuration(estimatedMinutes)}</span>
            </div>
          </div>
          {isAccepted && (
            <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7L6 10L11 4" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-300 leading-relaxed mb-4">
          {whyVisit}
        </p>

        {/* Actions */}
        {!isAccepted && onAccept && onReject && (
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Add to Route
            </button>
            <button
              onClick={onReject}
              className="py-2 px-3 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium text-sm transition-colors"
            >
              Skip
            </button>
          </div>
        )}

        {isAccepted && (
          <div className="text-center text-sm text-amber-500/80 font-medium">
            ✓ Added to your route
          </div>
        )}
      </div>
    </div>
  );
}
