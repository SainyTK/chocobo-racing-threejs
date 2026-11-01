/** Per-tab session tokens. Private browsing may disable storage; the game then simply forgets sessions on reload. */
export const sessionStore = {
  get(key: string) { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } },
  set(key: string, value: string) { try { sessionStorage.setItem(key, value); } catch { /* Storage unavailable. */ } },
  remove(key: string) { try { sessionStorage.removeItem(key); } catch { /* Storage unavailable. */ } },
};
