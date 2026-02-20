'use client';

/**
 * TransportModeSelector - Toggle between walk/drive/transit
 * 
 * Follows frontend.md guide:
 * - Distinctive pill-style buttons
 * - Smooth selection animation
 * - Clear visual feedback
 */

export type TransportMode = 'walking' | 'driving' | 'transit';

interface TransportModeSelectorProps {
    value: TransportMode;
    onChange: (mode: TransportMode) => void;
    className?: string;
}

const modes: { id: TransportMode; emoji: string; label: string; description: string }[] = [
    { id: 'walking', emoji: '🚶', label: 'Walk', description: 'Best for exploring' },
    { id: 'driving', emoji: '🚗', label: 'Drive', description: 'Cover more ground' },
    { id: 'transit', emoji: '🚇', label: 'Transit', description: 'Like a local' },
];

export function TransportModeSelector({ value, onChange, className = '' }: TransportModeSelectorProps) {
    return (
        <div className={`flex gap-1 p-1 bg-zinc-100 rounded-xl ${className}`}>
            {modes.map((mode) => {
                const isActive = value === mode.id;
                return (
                    <button
                        key={mode.id}
                        onClick={() => onChange(mode.id)}
                        className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
              transition-all duration-200 ease-out
              ${isActive
                                ? 'bg-white text-zinc-900 shadow-md transform scale-[1.02]'
                                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'
                            }
            `}
                        title={mode.description}
                    >
                        <span className="text-base">{mode.emoji}</span>
                        <span>{mode.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
