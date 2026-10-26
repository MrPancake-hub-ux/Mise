// Setpoint server file (Cloudflare Worker). It does three things:
// 1) Serves the website files from the "public" folder.
// 2) /api/ai: adds your secret Gemini key, picks the newest Gemini "flash" model that your key can use,
//    retries and falls back to other models when Google says "too many requests" or "not found", and can stream replies.
// 3) /api/subscribe: optional email sign-up that forwards to MailerLite.
// Secrets (set in the Cloudflare dashboard, NOT in this file): GEMINI_API_KEY, optional MAILERLITE_API_KEY
// Optional variables: MODEL, MAILERLITE_GROUP_ID, HOURLY_LIMIT, DAILY_PHOTOS, DAILY_TOTAL, ALLOWED_ORIGIN. Optional KV binding: RATE.

const API = "https://generativelanguage.googleapis.com/v1beta/models";
let modelCache = { at: 0, list: [] };
const badUntil = {}; // models that returned 404 recently
const noCfg = {}; // models that rejected the "thinking off" setting

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ai") return handleAI(request, env);
    if (url.pathname === "/api/subscribe") return handleSub(request, env);
    return env.ASSETS.fetch(request);
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const corsH = (env) => ({
  "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Expose-Headers": "X-Model",
});
const reply = (env, o, s = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...corsH(env), "Content-Type": "application/json", ...extra } });

// Cleans the key in case it was pasted with "export GEMINI_API_KEY=", quotes or spaces.
function getKey(env) {
  const raw = String(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GEMINI_KEY || "");
  const key = raw.trim().replace(/^export\s+\w+\s*=\s*/i, "").replace(/^\w+\s*=\s*/, "").replace(/^["']+|["']+$/g, "").trim();
  let problem = "";
  if (!raw) problem = "No secret named GEMINI_API_KEY exists on this Worker.";
  else if (key !== raw) problem = "The value had extra characters (quotes, spaces, export or a name=). The server cleaned them, but please paste only the key.";
  else if (/\s/.test(key)) problem = "The key contains spaces. Paste only the key.";
  return { key, problem };
}

const ver = (n) => n.split(".").map(Number);
const cmpVer = (a, b) => { for (let i = 0; i < 3; i++) { const d = (b[i] || 0) - (a[i] || 0); if (d) return d; } return 0; };

// Finds every "gemini-X.Y-flash" model your key can use, newest first, so the server upgrades itself.
async function discover(key) {
  if (Date.now() - modelCache.at < 3600000 && modelCache.list.length) return modelCache.list;
  try {
    const r = await fetch(`${API}?pageSize=200`, { headers: { "x-goog-api-key": key } });
    const j = await r.json();
    const list = (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace("models/", ""))
      .map((n) => { const x = n.match(/^gemini-(\d+(?:\.\d+)?)-flash(-lite)?$/); return x ? { n, v: ver(x[1]), lite: !!x[2] } : null; })
      .filter(Boolean)
      .sort((a, b) => cmpVer(a.v, b.v) || a.lite - b.lite)
      .map((x) => x.n);
    modelCache = { at: Date.now(), list };
    return list;
  } catch (e) {
    return modelCache.list;
  }
}

async function candidates(env, key, fast) {
  const out = [];
  if (env.MODEL) out.push(env.MODEL);
  let d = await discover(key);
  // "fast" requests (chat, logging, planning) try the lightweight flash-lite models first: much quicker replies.
  if (fast && d.length) d = [...d.filter((n) => /lite/.test(n)), ...d.filter((n) => !/lite/.test(n))];
  if (d.length) out.push(...d);
  else out.push("gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite");
  return [...new Set(out)].filter((m) => !(badUntil[m] > Date.now()));
}

function mkBody(b, omitThinking) {
  const parts = [{ text: b.text }];
  if (b.img) parts.push({ inline_data: { mime_type: "image/jpeg", data: b.img } });
  const gc = { maxOutputTokens: b.img ? 900 : b.fast ? 1100 : 1400, temperature: b.json ? 0.3 : 0.7 };
  if (b.json) gc.responseMimeType = "application/json";
  if (!omitThinking) gc.thinkingConfig = { thinkingBudget: 0 }; // answers faster; retried without if the model refuses
  return { contents: [{ role: "user", parts }], generationConfig: gc };
}

const callG = (key, m, b, stream, omit) =>
  fetch(`${API}/${m}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(mkBody(b, omit)),
  });

function errOf(status, text) {
  let msg = text;
  try { const j = JSON.parse(text); msg = (j.error && j.error.message) || text; } catch (e) {}
  msg = String(msg).slice(0, 220);
  let kind = "upstream";
  if (/api key not valid|API_KEY_INVALID|permission denied|unregistered/i.test(msg) || status === 401 || status === 403) kind = "key";
  else if (status === 429 || /quota|exhaust|rate/i.test(msg)) kind = "rate";
  else if (status === 404) kind = "model";
  return { status, kind, msg };
}

async function generate(env, key, b, stream) {
  const models = await candidates(env, key, !!b.fast && !b.img);
  if (!models.length) return { err: { status: 404, kind: "model", msg: "No Gemini model is available for this key." } };
  let last = { status: 502, kind: "upstream", msg: "No response from the AI provider." }, tries = 0;
  for (const m of models) {
    if (tries >= 5) break;
    for (let a = 0; a < 2; a++) {
      tries++;
      let r = await callG(key, m, b, stream, !!noCfg[m]);
      if (r.status === 400 && !noCfg[m]) {
        const t = await r.text();
        if (/thinking/i.test(t)) { noCfg[m] = 1; r = await callG(key, m, b, stream, true); }
        else { last = errOf(400, t); if (last.kind === "key") return { err: last }; break; }
      }
      if (r.ok) return { r, m };
      const t = await r.text();
      last = errOf(r.status, t);
      if (r.status === 404) { badUntil[m] = Date.now() + 3600000; break; }
      if (r.status === 429 || r.status >= 500) { if (a === 0) { await sleep(700 + Math.random() * 400); continue; } break; }
      if (last.kind === "key") return { err: last };
      break;
    }
  }
  return { err: last };
}

async function handleAI(req, env) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsH(env) });
  const K = getKey(env);
  if (req.method === "GET")
    return reply(env, { ok: true, keyConfigured: !!K.key, keyLength: K.key.length, keyProblem: K.problem, envNames: Object.keys(env), rateLimitStore: !!env.RATE, newsletter: !!env.MAILERLITE_API_KEY, model: env.MODEL || "auto (newest Gemini flash your key can use)" });
  if (req.method !== "POST") return reply(env, { error: "POST only" }, 405);
  if (!K.key) return reply(env, { error: "The server has no GEMINI_API_KEY secret yet.", kind: "key" }, 500);
  const b = await req.json().catch(() => ({}));
  if (!b.text || String(b.text).length > 24000) return reply(env, { error: "Bad request", kind: "upstream" }, 400);
  if (b.img && b.img.length > 2500000) return reply(env, { error: "Image too large", kind: "upstream" }, 413);
  const isPhoto = !!b.img;
  if (env.RATE) {
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    const day = new Date().toISOString().slice(0, 10);
    const key = isPhoto ? `p:${ip}:${day}` : `c:${ip}:${new Date().toISOString().slice(0, 13)}`;
    const limit = isPhoto ? +(env.DAILY_PHOTOS || 5) : +(env.HOURLY_LIMIT || 50);
    const used = +((await env.RATE.get(key)) || 0);
    if (used >= limit) return reply(env, { error: `Limit reached (${limit} ${isPhoto ? "photos per day" : "chats per hour"}).`, kind: "limit" }, 429);
    await env.RATE.put(key, String(used + 1), { expirationTtl: isPhoto ? 90000 : 3700 });
    if (env.DAILY_TOTAL) {
      const gk = `g:${day}`;
      const gu = +((await env.RATE.get(gk)) || 0);
      if (gu >= +env.DAILY_TOTAL) return reply(env, { error: "The shared AI is busy today. Try again tomorrow.", kind: "limit" }, 429);
      await env.RATE.put(gk, String(gu + 1), { expirationTtl: 90000 });
    }
  }
  const g = await generate(env, K.key, b, !!b.stream);
  if (g.err) return reply(env, { error: g.err.msg, kind: g.err.kind }, g.err.status === 429 ? 429 : g.err.status >= 400 && g.err.status < 600 ? g.err.status : 502);
  if (!b.stream) {
    const j = await g.r.json().catch(() => ({}));
    const text = ((j.candidates || [{}])[0].content || { parts: [] }).parts.map((p) => p.text || "").join("");
    if (!text) return reply(env, { error: "The AI returned an empty answer (it may have been blocked by a safety filter). Try rephrasing.", kind: "empty" }, 502);
    return reply(env, { text, model: g.m });
  }
  // Streaming: pass text to the browser as soon as Google produces it.
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), enc = new TextEncoder(), dec = new TextDecoder();
  (async () => {
    try {
      const rd = g.r.body.getReader();
      let buf = "";
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (line.startsWith("data:")) {
            try {
              const j = JSON.parse(line.slice(5));
              const t = ((j.candidates || [{}])[0].content || { parts: [] }).parts.map((p) => p.text || "").join("");
              if (t) await w.write(enc.encode(t));
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
    await w.close();
  })();
  return new Response(readable, { headers: { ...corsH(env), "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Model": g.m } });
}

async function handleSub(req, env) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsH(env) });
  if (req.method !== "POST") return reply(env, { error: "POST only" }, 405);
  if (!env.MAILERLITE_API_KEY) return reply(env, { error: "Email sign-up isn’t set up yet." }, 503);
  const b = await req.json().catch(() => ({}));
  if (b.website) return reply(env, { ok: true }); // hidden field: bots fill it in
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return reply(env, { error: "Enter a valid email address." }, 400);
  if (b.consent !== true) return reply(env, { error: "Please agree to receive emails." }, 400);
  if (env.RATE) {
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    const k = `s:${ip}:${new Date().toISOString().slice(0, 13)}`;
    const n = +((await env.RATE.get(k)) || 0);
    if (n >= 5) return reply(env, { error: "Too many sign-up attempts. Try again later." }, 429);
    await env.RATE.put(k, String(n + 1), { expirationTtl: 3700 });
  }
  const body = { email };
  if (env.MAILERLITE_GROUP_ID) body.groups = [env.MAILERLITE_GROUP_ID];
  const r = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + env.MAILERLITE_API_KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    return reply(env, { error: String(j.message || "Sign-up failed").slice(0, 120) }, 502);
  }
  return reply(env, { ok: true });
}
