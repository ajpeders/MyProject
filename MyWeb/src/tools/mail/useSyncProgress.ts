import { useCallback, useEffect, useRef, useState } from "react";

interface SyncStep {
  label: string;
  target: number;
  delay: number;
}

const SYNC_STEPS: SyncStep[] = [
  { label: "Connecting to mail server...", target: 10, delay: 1500 },
  { label: "Fetching emails...", target: 35, delay: 2500 },
  { label: "Merging saved analysis...", target: 50, delay: 1500 },
  { label: "Analyzing with AI...", target: 85, delay: 8000 },
  { label: "Saving results...", target: 95, delay: 0 },
];

const FETCH_STEPS: SyncStep[] = [
  { label: "Connecting to mail server...", target: 15, delay: 1500 },
  { label: "Fetching emails...", target: 60, delay: 2500 },
  { label: "Saving results...", target: 95, delay: 0 },
];

const ANALYZE_STEPS: SyncStep[] = [
  { label: "Analyzing with AI...", target: 85, delay: 8000 },
  { label: "Saving results...", target: 95, delay: 0 },
];

const STEP_MAP = { sync: SYNC_STEPS, fetch: FETCH_STEPS, analyze: ANALYZE_STEPS };

export type SyncMode = "sync" | "fetch" | "analyze";

export interface SyncProgress {
  label: string;
  percent: number;
  active: boolean;
  start: (mode: SyncMode) => void;
  finish: () => void;
}

export function useSyncProgress(): SyncProgress {
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState(0);
  const [active, setActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(0);
  const stepStartRef = useRef(0);
  const stepsRef = useRef<SyncStep[]>(SYNC_STEPS);

  const clear = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => clear, [clear]);

  const start = useCallback((mode: SyncMode) => {
    clear();
    const steps = STEP_MAP[mode];
    stepsRef.current = steps;
    stepRef.current = 0;
    stepStartRef.current = Date.now();
    setLabel(steps[0].label);
    setPercent(0);
    setActive(true);

    intervalRef.current = setInterval(() => {
      const step = stepsRef.current[stepRef.current];
      if (!step) return;

      const prev = stepRef.current > 0 ? stepsRef.current[stepRef.current - 1].target : 0;
      const elapsed = Date.now() - stepStartRef.current;
      const duration = step.delay || 2000;
      const progress = Math.min(elapsed / duration, 1);
      const current = prev + (step.target - prev) * progress;
      setPercent(Math.round(current));

      if (progress >= 1 && stepRef.current < stepsRef.current.length - 1) {
        stepRef.current += 1;
        stepStartRef.current = Date.now();
        setLabel(stepsRef.current[stepRef.current].label);
      }
    }, 100);
  }, [clear]);

  const finish = useCallback(() => {
    clear();
    setPercent(100);
    setLabel("Done");
    timeoutRef.current = setTimeout(() => {
      setActive(false);
      setPercent(0);
      setLabel("");
    }, 600);
  }, [clear]);

  return { label, percent, active, start, finish };
}
