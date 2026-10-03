import type { Item } from './items.ts';
import type { Racer } from './types.ts';

export function syncInventory(p: Racer) { p.item = p.stones.at(-1) || null; let n = 0; if (p.item) for (let i = p.stones.length - 1; i >= 0 && p.stones[i] === p.item; i--) n++; p.itemLevel = p.item === 'shield' || p.item === 'doom' ? Math.min(1, n) : n; }
export function addStone(p: Racer, kind: Item) { if (p.stones.length >= 3) return false; p.stones.push(kind); syncInventory(p); return true; }
