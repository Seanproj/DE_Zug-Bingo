import { useEffect, useRef, useState } from 'preact/hooks';

/** Tap vs. long-press on one element. Movement cancels (so scrolling never checks a square). */
export function usePress(onTap: () => void, onHold: () => void, holdMs = 450) {
  const timer = useRef<number>(0);
  const start = useRef<[number, number] | null>(null);
  const held = useRef(false);
  const clear = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      held.current = false;
      start.current = [e.clientX, e.clientY];
      timer.current = window.setTimeout(() => {
        held.current = true;
        start.current = null;
        onHold();
      }, holdMs);
    },
    onPointerMove(e: PointerEvent) {
      if (!start.current) return;
      const [x, y] = start.current;
      if (Math.hypot(e.clientX - x, e.clientY - y) > 10) clear();
    },
    onPointerUp() {
      const wasPressing = start.current !== null;
      clear();
      if (wasPressing && !held.current) onTap();
    },
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: Event) => e.preventDefault(),
    onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTap();
      } else if (e.key === 'i' || e.key === 'ContextMenu') {
        e.preventDefault();
        onHold();
      }
    },
  };
}

export function useOnline(onChange: (online: boolean) => void): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const up = () => (setOnline(true), cb.current(true));
    const down = () => (setOnline(false), cb.current(false));
    addEventListener('online', up);
    addEventListener('offline', down);
    return () => {
      removeEventListener('online', up);
      removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Smoothly animates a number towards `target`. */
export function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    if (origin === target) return;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(origin + (target - origin) * eased);
      setValue(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

/** Calls `fn` when the tab becomes visible again and every `ms` while visible. */
export function useHeartbeat(fn: () => void, ms = 30_000) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const run = () => document.visibilityState === 'visible' && cb.current();
    const id = setInterval(run, ms);
    document.addEventListener('visibilitychange', run);
    addEventListener('focus', run);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', run);
      removeEventListener('focus', run);
    };
  }, [ms]);
}
