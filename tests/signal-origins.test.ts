import { describe, expect, it } from 'vitest';
import { originAllowed } from '../signaling/src/origins.ts';

const ALLOWED = 'https://cbr.sainytk.com,https://chocobo-racing-*.vercel.app,https://*.trycloudflare.com,http://localhost:*';
describe('signaling Worker origins', () => {
  it('accepts the listed pages and tools without an Origin', () => {
    for (const origin of ['https://cbr.sainytk.com', 'https://chocobo-racing-git-main-team.vercel.app', 'https://quick-fox.trycloudflare.com', 'http://localhost:3218', null]) expect(originAllowed(origin, ALLOWED)).toBe(true);
  });
  it('rejects other pages, including look-alike hosts', () => {
    for (const origin of ['https://untrusted.example', 'https://cbr.sainytk.com.evil.example', 'https://evil.example/https://cbr.sainytk.com', 'http://cbr.sainytk.com', 'https://trycloudflare.com.evil.example', 'https://a.b.trycloudflare.com']) expect(originAllowed(origin, ALLOWED)).toBe(false);
  });
});
