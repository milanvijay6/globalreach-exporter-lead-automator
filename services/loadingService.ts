/**
 * Global Loading Service
 * Manages loading states across the entire application
 */

import React from 'react';

export type LoadingTask = {
  id: string;
  label?: string;
  progress?: number; // 0-100
};

class LoadingServiceClass {
  private tasks: Map<string, LoadingTask> = new Map();
  private listeners: Set<(tasks: LoadingTask[]) => void> = new Set();

  /**
   * Start a loading task
   */
  start(taskId: string, label?: string): void {
    this.tasks.set(taskId, {
      id: taskId,
      label,
      progress: 0
    });
    this.notify();
  }

  /**
   * Update progress for a loading task
   */
  updateProgress(taskId: string, progress: number): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.progress = Math.min(100, Math.max(0, progress));
      this.notify();
    }
  }

  /**
   * Complete a loading task
   */
  complete(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      // Animate to 100% before removing
      task.progress = 100;
      this.notify();
      
      // Remove after brief delay for smooth animation
      setTimeout(() => {
        this.tasks.delete(taskId);
        this.notify();
      }, 300);
    }
  }

  /**
   * Stop a loading task immediately
   */
  stop(taskId: string): void {
    this.tasks.delete(taskId);
    this.notify();
  }

  /**
   * Check if any tasks are loading
   */
  isLoading(): boolean {
    return this.tasks.size > 0;
  }

  /**
   * Get current loading tasks
   */
  getTasks(): LoadingTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get overall progress (average of all tasks)
   */
  getOverallProgress(): number {
    if (this.tasks.size === 0) return 100;
    
    const tasks = Array.from(this.tasks.values());
    const totalProgress = tasks.reduce((sum, task) => sum + (task.progress || 0), 0);
    return Math.round(totalProgress / tasks.length);
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(listener: (tasks: LoadingTask[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notify(): void {
    const tasks = this.getTasks();
    this.listeners.forEach(listener => listener(tasks));
  }

  /**
   * Clear all loading tasks
   */
  clear(): void {
    this.tasks.clear();
    this.notify();
  }
}

export const LoadingService = new LoadingServiceClass();

/**
 * Hook to track loading state
 */
export function useLoadingState(): {
  isLoading: boolean;
  progress: number;
  tasks: LoadingTask[];
} {
  const [state, setState] = React.useState({
    isLoading: LoadingService.isLoading(),
    progress: LoadingService.getOverallProgress(),
    tasks: LoadingService.getTasks()
  });

  React.useEffect(() => {
    const unsubscribe = LoadingService.subscribe((tasks) => {
      setState({
        isLoading: tasks.length > 0,
        progress: LoadingService.getOverallProgress(),
        tasks
      });
    });

    return unsubscribe;
  }, []);

  return state;
}

