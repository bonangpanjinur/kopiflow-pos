import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;
        const body =
          `User-agent: *\n` +
          `Disallow: /app/\n` +
          `Disallow: /admin/\n` +
          `Disallow: /api/\n` +
          `Disallow: /onboarding\n` +
          `Disallow: /invite/\n` +
          `Allow: /\n\n` +
          `Sitemap: ${origin}/sitemap.xml\n`;
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
