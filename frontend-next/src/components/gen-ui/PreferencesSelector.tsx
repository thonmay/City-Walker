'use client';

/**
 * Preferences Selector - Interactive options for user input
 */

import { useState } from 'react';

interface Option {
  label: string;
  value: string;
  emoji?: string;
}

interface PreferencesSelectorProps {
  question: string;
  options: Option[];
  allowMultiple: boolean;
  onSelect?: (selected: string[]) => void;
}

export function PreferencesSelector({
  question,
  options,
  allowMultiple,
  onSelect,
}: PreferencesSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handleToggle = (value: string) => {
    if (submitted) return;
    
    if (allowMultiple) {
      setSelected(prev => 
        prev.includes(value) 
          ? prev.filter(v => v !== value)
          : [...prev, value]
      );
    } else {
      setSelected([value]);
    }
  };

  const handleSubmit = () => {
    if (selected.length > 0) {
      setSubmitted(true);
      onSelect?.(selected);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Selected: {selected.map(v => options.find(o => o.value === v)?.label).join(', ')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-zinc-800/80 border border-zinc-700 p-4">
      <h3 className="font-medium text-white mb-3">{question}</h3>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleToggle(option.value)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              flex items-center gap-2
              ${selected.includes(option.value)
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }
            `}
          >
            {option.emoji && <span>{option.emoji}</span>}
            {option.label}
          </button>
        ))}
      </div>

      {allowMultiple && (
        <p className="text-xs text-zinc-500 mb-3">
          Select all that apply
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={selected.length === 0}
        className={`
          w-full py-2.5 rounded-lg font-medium text-sm transition-all
          ${selected.length > 0
            ? 'bg-amber-500 hover:bg-amber-400 text-black'
            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }
        `}
      >
        Continue
      </button>
    </div>
  );
}
