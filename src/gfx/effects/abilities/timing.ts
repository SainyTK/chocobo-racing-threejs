/** Progress 0 to 1 of `t` through the window `[from, to]`, or -1 outside it. */
export const within = (t: number, [from, to]: readonly [number, number] | readonly number[]) => t < from || t > to ? -1 : (t - from) / (to - from);
/** An envelope over a window's progress that rises over its first `rise` and fades over the rest; 0 outside it. */
export const swell = (k: number, rise = .25) => k < 0 ? 0 : k < rise ? k / rise : 1 - ((k - rise) / (1 - rise)) ** 1.5;
export const smooth = (k: number) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
/** A repeatable 0 to 1 random number for `n`, so a sprite can keep its shape for a frame and re-roll on the next. */
export const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** A random between `a` and `b` from `hash`. */
export const hashIn = (n: number, a: number, b: number) => a + hash(n) * (b - a);
/** Progress 0 to 1 of `t` through `[from, to]`, held at 0 before and 1 after. */
export const progress = (t: number, [from, to]: readonly number[]) => Math.min(1, Math.max(0, (t - from) / (to - from)));
