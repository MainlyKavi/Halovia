/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleApi, runRetentionCleanup } from "./api";
import type { Env, ExecutionContext, ScheduledController } from "./runtime-types";

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) return handleApi(request, env);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Permissions-Policy", "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()");
    if (url.pathname.startsWith("/viewer/")) {
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    headers.set("Content-Security-Policy", [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://tiles.openfreemap.org",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://tiles.openfreemap.org https://routing.openstreetmap.de",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    void controller;
    ctx.waitUntil(runRetentionCleanup(env));
  },
};

export default worker;
