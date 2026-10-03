export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const mod = (v: number, m: number) => ((v % m) + m) % m;
export const angleDelta = (to: number, from: number) => mod(to - from + Math.PI, Math.PI * 2) - Math.PI;
