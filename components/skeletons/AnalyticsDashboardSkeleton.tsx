import React from 'react';

export const AnalyticsDashboardSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-lg border border-slate-200">
            <div className="h-4 w-24 bg-slate-200 rounded mb-2 animate-pulse" />
            <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-lg border border-slate-200">
            <div className="h-5 w-32 bg-slate-200 rounded mb-4 animate-pulse" />
            <div className="h-64 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
};









