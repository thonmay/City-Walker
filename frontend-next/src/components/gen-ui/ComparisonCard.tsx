'use client';

/**
 * Comparison Card - Side by side place comparison
 */

interface Place {
  name: string;
  pros: string[];
  cons: string[];
  duration: string;
}

interface ComparisonCardProps {
  place1: Place;
  place2: Place;
  onSelect?: (place: 'place1' | 'place2' | 'both') => void;
}

export function ComparisonCard({ place1, place2, onSelect }: ComparisonCardProps) {
  return (
    <div className="rounded-xl bg-zinc-800/80 border border-zinc-700 overflow-hidden">
      <div className="p-3 bg-zinc-700/50 border-b border-zinc-700">
        <h3 className="font-medium text-white text-center">Which would you prefer?</h3>
      </div>

      <div className="grid grid-cols-2 divide-x divide-zinc-700">
        {/* Place 1 */}
        <div className="p-4">
          <h4 className="font-semibold text-white mb-2">{place1.name}</h4>
          <p className="text-xs text-amber-500/80 mb-3">~{place1.duration}</p>
          
          <div className="space-y-2 mb-4">
            {place1.pros.map((pro, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-green-500">✓</span>
                <span className="text-zinc-300">{pro}</span>
              </div>
            ))}
            {place1.cons.map((con, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-red-400">✗</span>
                <span className="text-zinc-400">{con}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => onSelect?.('place1')}
            className="w-full py-2 rounded-lg bg-zinc-700 hover:bg-amber-500 hover:text-black text-zinc-300 text-sm font-medium transition-colors"
          >
            Choose {place1.name}
          </button>
        </div>

        {/* Place 2 */}
        <div className="p-4">
          <h4 className="font-semibold text-white mb-2">{place2.name}</h4>
          <p className="text-xs text-amber-500/80 mb-3">~{place2.duration}</p>
          
          <div className="space-y-2 mb-4">
            {place2.pros.map((pro, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-green-500">✓</span>
                <span className="text-zinc-300">{pro}</span>
              </div>
            ))}
            {place2.cons.map((con, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-red-400">✗</span>
                <span className="text-zinc-400">{con}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => onSelect?.('place2')}
            className="w-full py-2 rounded-lg bg-zinc-700 hover:bg-amber-500 hover:text-black text-zinc-300 text-sm font-medium transition-colors"
          >
            Choose {place2.name}
          </button>
        </div>
      </div>

      {/* Both option */}
      <div className="p-3 border-t border-zinc-700">
        <button
          onClick={() => onSelect?.('both')}
          className="w-full py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors"
        >
          Add both to my route
        </button>
      </div>
    </div>
  );
}
