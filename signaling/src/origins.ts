/**
 * `allowed` is a comma-separated list of exact origins, where `*` matches one host label or a port, as in
 * `https://*.trycloudflare.com` or `http://localhost:*`. Requests without an Origin come from tools, not web pages.
 */
export function originAllowed(origin: string | null, allowed: string) {
  if (!origin) return true;
  return allowed.split(',').map(s => s.trim()).filter(Boolean).some(pattern => {
    const source = pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('[a-z0-9-]*');
    return new RegExp(`^${source}$`, 'i').test(origin);
  });
}
