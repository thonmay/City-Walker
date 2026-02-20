'use client';

/**
 * Day Plan Card - Shows summary of a day's itinerary
 */

interface DayPlanCardProps {
  dayNumber: number;
  theme: string;
  totalStops: number;
  estimatedHours: number;
  highlights: string[];
}

export function DayPlanCard({
  dayNumber,
  theme,
  totalStops,
  estimatedHours,
  highlights,
}: DayPlanCardProps) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-3 border-b border-zinc-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-sm">
              {dayNumber}
            </div>
            <div>
              <h3 className="font-semibold text-white">Day {dayNumber}</h3>
              <p className="text-xs text-amber-400/80">{theme}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-white">{totalStops}</div>
            <div className="text-xs text-zinc-400">stops</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 flex items-center gap-4 border-b border-zinc-700/50">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-400">⏱️</span>
          <span className="text-zinc-300">{estimatedHours}h estimated</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-400">🚶</span>
          <span className="text-zinc-300">Walking tour</span>
        </div>
      </div>

      {/* Highlights */}
      <div className="p-4">
        <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
          Highlights
        </h4>
        <ul className="space-y-2">
          {highlights.map((highlight, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-amber-500 mt-0.5">•</span>
              <span className="text-zinc-300">{highlight}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
