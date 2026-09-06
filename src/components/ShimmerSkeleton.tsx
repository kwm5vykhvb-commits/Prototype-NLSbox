import React from 'react';

interface ShimmerSkeletonProps {
  count?: number;
}

export const ShimmerSkeleton: React.FC<ShimmerSkeletonProps> = ({ count = 5 }) => {
  // Array of widths to make the placeholder titles look organic and varied
  const titleWidths = ['w-3/4', 'w-5/6', 'w-2/3', 'w-4/5', 'w-11/12'];
  const subtitleWidths = ['w-1/2', 'w-2/5', 'w-3/5', 'w-1/3', 'w-1/2'];

  return (
    <div className="space-y-3" role="status" aria-label="Chargement des épisodes...">
      {Array.from({ length: count }).map((_, index) => {
        const titleWidth = titleWidths[index % titleWidths.length];
        const subtitleWidth = subtitleWidths[index % subtitleWidths.length];

        return (
          <div
            key={index}
            className="relative overflow-hidden bg-[#1A1A22] rounded-xl p-3 border border-white/5 shadow-md flex items-center gap-3.5 select-none"
          >
            {/* Shimmer light beam effect */}
            <div
              className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent pointer-events-none"
              aria-hidden="true"
            />

            {/* Video Poster / Play preview placeholder */}
            <div className="relative w-18 h-18 sm:w-20 sm:h-20 bg-white/5 rounded-lg shrink-0 overflow-hidden flex items-center justify-center border border-white/5 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-xs bg-white/20 ml-0.5" />
              </div>
            </div>

            {/* Episode details placeholder */}
            <div className="flex-1 min-w-0 space-y-2 py-0.5">
              {/* Title lines */}
              <div className="space-y-1.5 animate-pulse">
                <div className={`h-4 bg-white/10 rounded-md ${titleWidth}`} />
                <div className={`h-3 bg-white/5 rounded-md ${subtitleWidth}`} />
              </div>

              {/* Metadata Badges row */}
              <div className="flex items-center gap-1.5 pt-1 animate-pulse">
                {/* Channel badge placeholder */}
                <div className="h-4.5 w-18 rounded bg-purple-500/10 border border-purple-500/20" />
                {/* Size badge placeholder */}
                <div className="h-4.5 w-14 rounded bg-white/5 border border-white/5" />
                {/* Quality badge placeholder */}
                <div className="h-4.5 w-12 rounded bg-white/5 border border-white/5" />
              </div>
            </div>

            {/* Action button placeholder (Download icon) */}
            <div className="shrink-0 flex items-center animate-pulse">
              <div className="w-9 h-9 rounded-full bg-white/5 border border-white/5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
