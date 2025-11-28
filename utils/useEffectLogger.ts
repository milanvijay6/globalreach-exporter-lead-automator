/**
 * Custom hook to log useEffect executions for debugging infinite loops
 * Usage: useEffectLogger('ComponentName', 'effectDescription', dependencies);
 */
import { useEffect, useRef } from 'react';

export function useEffectLogger(
  componentName: string,
  effectDescription: string,
  dependencies: any[]
) {
  const renderCountRef = useRef(0);
  const lastDepsRef = useRef<any[]>([]);
  const callTimeRef = useRef<number[]>([]);

  useEffect(() => {
    renderCountRef.current += 1;
    const now = Date.now();
    callTimeRef.current.push(now);
    
    // Keep only last 10 call times
    if (callTimeRef.current.length > 10) {
      callTimeRef.current.shift();
    }
    
    // Check if called too frequently (potential infinite loop)
    if (callTimeRef.current.length >= 3) {
      const recentCalls = callTimeRef.current.slice(-3);
      const timeDiff = recentCalls[recentCalls.length - 1] - recentCalls[0];
      if (timeDiff < 100) { // Called 3+ times in less than 100ms
        console.warn(`⚠️ [${componentName}] useEffect "${effectDescription}" called ${renderCountRef.current} times rapidly!`);
        console.warn(`   Last 3 calls in ${timeDiff}ms - Possible infinite loop!`);
        console.trace('Stack trace:');
      }
    }
    
    // Log dependency changes
    const depsChanged = dependencies.some((dep, idx) => {
      const lastDep = lastDepsRef.current[idx];
      return dep !== lastDep;
    });
    
    if (depsChanged || renderCountRef.current === 1) {
      console.log(`[${componentName}] useEffect "${effectDescription}"`, {
        callCount: renderCountRef.current,
        dependencies: dependencies.map((d, i) => ({
          index: i,
          value: typeof d === 'object' ? JSON.stringify(d).substring(0, 50) : d,
          changed: d !== lastDepsRef.current[i]
        })),
        timestamp: new Date().toISOString()
      });
    }
    
    lastDepsRef.current = [...dependencies];
  });
}

/**
 * Hook to track state updates and detect rapid updates
 */
export function useStateLogger<T>(
  componentName: string,
  stateName: string,
  value: T
) {
  const updateCountRef = useRef(0);
  const lastValueRef = useRef(value);
  const updateTimesRef = useRef<number[]>([]);

  if (value !== lastValueRef.current) {
    updateCountRef.current += 1;
    const now = Date.now();
    updateTimesRef.current.push(now);
    
    // Keep only last 10 update times
    if (updateTimesRef.current.length > 10) {
      updateTimesRef.current.shift();
    }
    
    // Check for rapid updates
    if (updateTimesRef.current.length >= 5) {
      const recentUpdates = updateTimesRef.current.slice(-5);
      const timeDiff = recentUpdates[recentUpdates.length - 1] - recentUpdates[0];
      if (timeDiff < 200) { // 5+ updates in less than 200ms
        console.error(`🚨 [${componentName}] State "${stateName}" updated ${updateCountRef.current} times rapidly!`);
        console.error(`   Last 5 updates in ${timeDiff}ms - Possible infinite loop!`);
        console.trace('Stack trace:');
      }
    }
    
    console.log(`[${componentName}] State "${stateName}" updated`, {
      updateCount: updateCountRef.current,
      previousValue: lastValueRef.current,
      newValue: value,
      timestamp: new Date().toISOString()
    });
    
    lastValueRef.current = value;
  }
}

