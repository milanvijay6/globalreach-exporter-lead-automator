import React, { lazy, Suspense } from 'react';

// Dynamically import Recharts
const RechartsModule = lazy(() => import('recharts'));

interface RechartsWrapperProps {
  children: (components: {
    BarChart: any;
    Bar: any;
    XAxis: any;
    YAxis: any;
    Tooltip: any;
    ResponsiveContainer: any;
    Cell: any;
    AreaChart: any;
    Area: any;
    CartesianGrid: any;
    PieChart: any;
    Pie: any;
    Legend: any;
    LineChart: any;
    Line: any;
  }) => React.ReactNode;
  fallback?: React.ReactNode;
}

export const RechartsWrapper: React.FC<RechartsWrapperProps> = ({ children, fallback }) => {
  return (
    <Suspense fallback={fallback || <div className="h-full w-full flex items-center justify-center"><div className="text-slate-400 text-sm">Loading charts...</div></div>}>
      <RechartsModule>
        {(module: typeof import('recharts')) => children({
          BarChart: module.BarChart,
          Bar: module.Bar,
          XAxis: module.XAxis,
          YAxis: module.YAxis,
          Tooltip: module.Tooltip,
          ResponsiveContainer: module.ResponsiveContainer,
          Cell: module.Cell,
          AreaChart: module.AreaChart,
          Area: module.Area,
          CartesianGrid: module.CartesianGrid,
          PieChart: module.PieChart,
          Pie: module.Pie,
          Legend: module.Legend,
          LineChart: module.LineChart,
          Line: module.Line,
        })}
      </RechartsModule>
    </Suspense>
  );
};

// Hook that loads Recharts dynamically
let rechartsCache: typeof import('recharts') | null = null;
let rechartsPromise: Promise<typeof import('recharts')> | null = null;

export const useRecharts = () => {
  const [recharts, setRecharts] = React.useState<typeof import('recharts') | null>(rechartsCache);
  const [loading, setLoading] = React.useState(!rechartsCache);

  React.useEffect(() => {
    if (rechartsCache) {
      return;
    }

    if (!rechartsPromise) {
      rechartsPromise = import('recharts');
    }

    rechartsPromise.then((module) => {
      rechartsCache = module;
      setRecharts(module);
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to load Recharts:', error);
      setLoading(false);
    });
  }, []);

  return { recharts, loading };
};

