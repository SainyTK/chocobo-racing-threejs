import type { Every } from '../../shared/room/host.ts';

/**
 * Browsers slow a hidden tab's timers to about once a second, which would freeze a race hosted in it. Timers inside a
 * worker keep their rate, so the hosting page's race loop ticks from one.
 */
export const backgroundEvery: Every = (ms, fn) => {
  const worker = new Worker(new URL('./ticker-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = () => fn();
  worker.postMessage(ms);
  return () => worker.terminate();
};
