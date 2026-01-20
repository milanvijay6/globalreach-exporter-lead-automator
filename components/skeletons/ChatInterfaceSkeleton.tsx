import React from 'react';

export const ChatInterfaceSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-white md:rounded-lg md:shadow md:border border-slate-200">
      {/* Header Skeleton */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-8 w-8 bg-slate-200 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Chat Area Skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`flex flex-col max-w-[85%] ${
              i % 2 === 0 ? 'self-end items-end' : 'self-start items-start'
            }`}
          >
            <div className="h-16 w-48 bg-slate-200 rounded-2xl animate-pulse" />
            <div className="h-3 w-24 bg-slate-200 rounded mt-1 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Input Skeleton */}
      <div className="p-3 bg-white border-t border-slate-200">
        <div className="h-10 w-full bg-slate-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
};









