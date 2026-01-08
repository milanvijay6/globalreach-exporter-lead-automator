import React from 'react';

export const ImporterListSkeleton: React.FC = () => {
  return (
    <div className="bg-white md:rounded-lg md:shadow md:border border-slate-200 flex flex-col h-full w-full">
      {/* Header Skeleton */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 md:rounded-t-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-20 bg-slate-200 rounded animate-pulse" />
          <div className="h-5 w-8 bg-slate-200 rounded-full animate-pulse" />
        </div>
        <div className="h-9 w-full bg-slate-200 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 flex-1 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-8 w-[120px] bg-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* List Items Skeleton */}
      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="w-full p-3 md:p-4 rounded-lg border border-slate-100 bg-white animate-pulse"
          >
            <div className="flex justify-between items-start mb-1">
              <div className="h-4 w-2/3 bg-slate-200 rounded" />
              <div className="flex gap-1">
                <div className="h-5 w-12 bg-slate-200 rounded" />
                <div className="h-5 w-10 bg-slate-200 rounded" />
              </div>
            </div>
            <div className="h-3 w-1/4 bg-slate-200 rounded mb-2" />
            <div className="flex gap-2 mb-3">
              <div className="h-6 w-6 bg-slate-200 rounded-full" />
              <div className="h-6 w-6 bg-slate-200 rounded-full" />
            </div>
            <div className="h-3 w-3/4 bg-slate-200 rounded mb-2" />
            <div className="flex justify-between items-center mt-2">
              <div className="h-5 w-20 bg-slate-200 rounded-full" />
              <div className="h-3 w-16 bg-slate-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};






