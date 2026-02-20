'use client';

/**
 * DayTabs - Multi-day itinerary tab selector
 * 
 * For travelers planning multi-day trips:
 * - Easy day navigation with visual feedback
 * - Add/remove days
 * - Shows POI count per day
 * 
 * Follows frontend.md with distinctive styling
 */

export interface DayInfo {
    day: number;
    poiCount: number;
    duration?: string; // e.g., "~4 hours"
}

interface DayTabsProps {
    days: DayInfo[];
    selectedDay: number;
    onDayChange: (day: number) => void;
    onAddDay?: () => void;
    onRemoveDay?: (day: number) => void;
    maxDays?: number;
    className?: string;
}

export function DayTabs({
    days,
    selectedDay,
    onDayChange,
    onAddDay,
    onRemoveDay,
    maxDays = 7,
    className = ''
}: DayTabsProps) {

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Day tabs - horizontal scroll on mobile */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                {days.map((dayInfo) => {
                    const isSelected = selectedDay === dayInfo.day;
                    return (
                        <button
                            key={dayInfo.day}
                            onClick={() => onDayChange(dayInfo.day)}
                            className={`
                relative flex flex-col items-center px-4 py-2 rounded-xl min-w-[70px]
                font-medium text-sm transition-all duration-200
                ${isSelected
                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                    : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                                }
              `}
                        >
                            <span className="text-xs opacity-80">Day</span>
                            <span className="text-lg font-bold">{dayInfo.day}</span>
                            {dayInfo.poiCount > 0 && (
                                <span className={`text-xs mt-0.5 ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>
                                    {dayInfo.poiCount} stops
                                </span>
                            )}

                            {/* Remove button for non-first days when selected */}
                            {isSelected && dayInfo.day > 1 && onRemoveDay && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveDay(dayInfo.day);
                                    }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white shadow-md hover:bg-red-600 transition-colors"
                                    title="Remove day"
                                >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </button>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Add day button */}
            {onAddDay && days.length < maxDays && (
                <button
                    onClick={onAddDay}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors text-sm font-medium"
                    title="Add another day"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="hidden sm:inline">Add Day</span>
                </button>
            )}
        </div>
    );
}

/**
 * TripDurationSelector - Quick trip duration presets
 */
interface TripDurationSelectorProps {
    value: number; // Number of days
    onChange: (days: number) => void;
    className?: string;
}

const durations = [
    { days: 1, label: 'Day Trip', emoji: '☀️' },
    { days: 2, label: 'Weekend', emoji: '🌴' },
    { days: 3, label: '3 Days', emoji: '✨' },
    { days: 5, label: '5 Days', emoji: '🎒' },
    { days: 7, label: 'Week', emoji: '🌍' },
];

export function TripDurationSelector({ value, onChange, className = '' }: TripDurationSelectorProps) {
    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {durations.map((dur) => {
                const isSelected = value === dur.days;
                return (
                    <button
                        key={dur.days}
                        onClick={() => onChange(dur.days)}
                        className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200
              ${isSelected
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                                : 'bg-white text-zinc-700 border border-zinc-200 hover:border-amber-300 hover:bg-amber-50'
                            }
            `}
                    >
                        <span>{dur.emoji}</span>
                        <span>{dur.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
