'use client';

/**
 * Progress Indicator - Shows loading/processing state
 */

interface ProgressIndicatorProps {
  message: string;
  step: number;
  totalSteps: number;
}

export function ProgressIndicator({ message, step, totalSteps }: ProgressIndicatorProps) {
  const progress = (step / totalSteps) * 100;

  return (
    <div className="rounded-xl bg-zinc-800/80 border border-zinc-700 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-white font-medium">{message}</p>
          <p className="text-xs text-zinc-500">Step {step} of {totalSteps}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
