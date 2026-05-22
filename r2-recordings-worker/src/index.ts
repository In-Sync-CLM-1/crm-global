export interface Env {
  RECORDINGS: R2Bucket;
  SHARED_SECRET: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const auth = req.headers.get("Authorization");
    if (!env.SHARED_SECRET || auth !== `Bearer ${env.SHARED_SECRET}`) {
      return unauthorized();
    }

    const url = new URL(req.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!key) {
      return new Response("Missing object key", { status: 400, headers: CORS_HEADERS });
    }

    if (req.method === "PUT") {
      const contentType = req.headers.get("Content-Type") || "audio/mpeg";
      await env.RECORDINGS.put(key, req.body, {
        httpMetadata: { contentType },
      });
      return new Response(JSON.stringify({ ok: true, key }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" || req.method === "HEAD") {
      const obj = await env.RECORDINGS.get(key);
      if (!obj) {
        return new Response("Not found", { status: 404, headers: CORS_HEADERS });
      }
      const headers = new Headers(CORS_HEADERS);
      headers.set("Content-Type", obj.httpMetadata?.contentType || "audio/mpeg");
      headers.set("Content-Length", obj.size.toString());
      headers.set("Cache-Control", "private, max-age=300");
      if (req.method === "HEAD") {
        return new Response(null, { headers });
      }
      return new Response(obj.body, { headers });
    }

    if (req.method === "DELETE") {
      await env.RECORDINGS.delete(key);
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  },
};
