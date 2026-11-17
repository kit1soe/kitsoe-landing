import type { APIRoute } from 'astro';
export const GET: APIRoute = () => {
  const url = import.meta.env.PUBLIC_SITE_URL?.trim();
  const allowed = import.meta.env.PUBLIC_ALLOW_INDEXING === 'true' && url && /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url);
  return new Response(allowed ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n', {headers:{'Content-Type':'text/plain; charset=utf-8'}});
};
