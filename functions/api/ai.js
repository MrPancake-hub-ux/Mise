// Cloudflare Pages Function. Lives at functions/api/ai.js, so it is served at https://YOURSITE/api/ai on the SAME site as the app.
// Hides your Gemini key and rate-limits per IP. In Pages: Settings > Variables and Secrets (GEMINI_API_KEY) and Bindings > KV (RATE).
// Bindings needed: secret GEMINI_API_KEY, KV namespace RATE, optional vars MODEL, ALLOWED_ORIGIN, HOURLY_LIMIT, DAILY_PHOTOS, DAILY_TOTAL (global cap that protects your quota)
async function handle(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    };
    const reply = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method === "GET") return reply({ ok: true, keyConfigured: !!env.GEMINI_API_KEY, rateLimitStore: !!env.RATE });
    if (req.method !== "POST") return reply({ error: "POST only" }, 405);
    const b = await req.json().catch(() => ({}));
    if (!b.text || String(b.text).length > 8000) return reply({ error: "Bad request" }, 400);
    if (b.img && b.img.length > 2_500_000) return reply({ error: "Image too large" }, 413);
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    const isPhoto = !!b.img;
    const key = isPhoto ? `p:${ip}:${new Date().toISOString().slice(0, 10)}` : `c:${ip}:${new Date().toISOString().slice(0, 13)}`;
    const limit = isPhoto ? +(env.DAILY_PHOTOS || 5) : +(env.HOURLY_LIMIT || 50);
    const used = +((await env.RATE.get(key)) || 0);
    if (used >= limit) return reply({ error: `Limit reached (${limit} ${isPhoto ? "photos per day" : "chats per hour"}).` }, 429);
    await env.RATE.put(key, String(used + 1), { expirationTtl: isPhoto ? 90000 : 3700 });
    if (env.DAILY_TOTAL) {
      const gk = `g:${new Date().toISOString().slice(0, 10)}`;
      const gu = +((await env.RATE.get(gk)) || 0);
      if (gu >= +env.DAILY_TOTAL) return reply({ error: "The shared AI is busy today. Try again tomorrow." }, 429);
      await env.RATE.put(gk, String(gu + 1), { expirationTtl: 90000 });
    }
    const parts = [{ text: b.text }];
    if (b.img) parts.push({ inline_data: { mime_type: "image/jpeg", data: b.img } });
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.MODEL || "gemini-2.5-flash"}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: b.json ? { responseMimeType: "application/json" } : {} }),
      }
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return reply({ error: (j.error && j.error.message) || "Upstream error" }, r.status);
    const text = ((j.candidates || [{}])[0].content || { parts: [] }).parts.map((p) => p.text || "").join("");
    return reply({ text });
}
export async function onRequest({ request, env }) {
  return handle(request, env);
}
