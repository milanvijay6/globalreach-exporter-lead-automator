import React, { useEffect, useState } from 'react';
import { LoadingService } from '../services/loadingService';

/**
 * Global Loading Bar Component
 * Shows a progress bar at the top of the screen when any loading is in progress
 */
const LoadingBar: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = LoadingService.subscribe((updatedTasks) => {
      const loading = updatedTasks.length > 0;
      const overallProgress = LoadingService.getOverallProgress();
      setIsLoading(loading);
      setProgress(overallProgress);
      setTasks(updatedTasks);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isLoading) {
      setIsVisible(true);
      // Smooth progress animation
      const interval = setInterval(() => {
        setDisplayProgress(prev => {
          const diff = progress - prev;
          // Move 10% closer to target per frame for smooth animation
          return prev + diff * 0.1;
        });
      }, 16); // ~60fps

      return () => clearInterval(interval);
    } else {
      // Complete animation before hiding
      setDisplayProgress(100);
      setTimeout(() => {
        setIsVisible(false);
        setDisplayProgress(0);
      }, 300);
    }
  }, [isLoading, progress]);

  if (!isVisible && !isLoading) {
    return null;
  }

  // Get primary task label for display
  const primaryTask = tasks.length > 0 ? tasks[0] : null;
  const label = primaryTask?.label || 'Loading...';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
      style={{
        transition: 'opacity 0.3s ease-in-out',
        opacity: isVisible ? 1 : 0
      }}
    >
      {/* Progress Bar */}
      <div
        className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg"
        style={{
          width: `${Math.min(100, Math.max(0, displayProgress))}%`,
          transition: isLoading ? 'width 0.2s ease-out' : 'width 0.3s ease-in',
          boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
        }}
      >
        {/* Animated shimmer effect */}
        <div
          className="h-full bg-white opacity-30 animate-shimmer"
          style={{
            width: '50%',
            transform: 'translateX(-100%)',
            animation: 'shimmer 2s infinite'
          }}
        />
      </div>

      {/* Loading Label (optional, can be toggled) */}
      {primaryTask && primaryTask.label && (
        <div
          className="bg-indigo-600 text-white text-xs px-4 py-1 text-center"
          style={{
            transition: 'opacity 0.3s ease-in-out',
            opacity: isVisible ? 0.95 : 0
          }}
        >
          {label}
          {tasks.length > 1 && ` (${tasks.length} tasks)`}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingBar;

