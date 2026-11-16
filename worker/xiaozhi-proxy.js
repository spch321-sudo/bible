/* ============================================================
 * 小智 AI 代理（Cloudflare Worker）v2 — 雙模型分流
 * 用途：替前端保管 Anthropic 金鑰、轉發請求、處理 CORS。
 * 必要 Secret：ANTHROPIC_API_KEY
 * 選用變數：DEFAULT_TIER（'fast' 或 'deep'，沒填＝'fast'）
 *
 * v2 改動（對照舊版）：
 *  · 前端送 tier:'deep' → Sonnet 5.5；tier:'fast'／沒送 → Haiku 5.5（DEFAULT_TIER 可改預設）
 *  · 舊版「body.model 想填什麼就用什麼」是漏洞（別人可指定最貴的模型），
 *    改成只接受白名單內的模型；不在白名單就依 tier 決定
 *  · 上游 429／5xx／網路錯誤時，自動換另一個模型再試一次
 *  · 回應加 X-XZ-Model（實際用的模型）與 X-XZ-Fallback（有沒有換過），方便對帳
 *  · v2.77：前端送 stream:true 時，回傳 SSE 串流（逐字顯示）；沒送就維持原本的 JSON 回應
 *  · v2.77.2：送出時加 thinking:{type:"disabled"}（避免額度被「先思考」吃光而回空字串）；上游 400 且提到 thinking 時自動拿掉再送
 *  · 其餘行為不變：max_tokens 上限 1024、只轉 system 與 messages
 * ============================================================ */

const ALLOW_ORIGINS = [
  "https://spch321-sudo.github.io",
  "http://localhost",
  "http://localhost:8080",
  "http://127.0.0.1"
];

const MODEL_FAST = "claude-haiku-5-5";
const MODEL_DEEP = "claude-sonnet-5-5";
/* 允許呼叫端直接指定的模型（含舊 App 可能還在送的舊代號）。要新增就加在這裡。 */
const ALLOWED_MODELS = [MODEL_FAST, MODEL_DEEP, "claude-sonnet-4-6", "claude-haiku-4-5"];
const RETRY_STATUS = { 429: 1, 500: 1, 502: 1, 503: 1, 504: 1, 529: 1 };

function corsHeaders(origin) {
  const allow = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers": "X-XZ-Model, X-XZ-Fallback",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function pickModel(body, env) {
  if (typeof body.model === "string" && ALLOWED_MODELS.indexOf(body.model) > -1) return body.model;
  const t = body.tier === "deep" || body.tier === "fast" ? body.tier : (env.DEFAULT_TIER === "deep" ? "deep" : "fast");
  return t === "deep" ? MODEL_DEEP : MODEL_FAST;
}
function otherModel(m) {
  return m === MODEL_DEEP ? MODEL_FAST : MODEL_DEEP;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "伺服器尚未設定 ANTHROPIC_API_KEY" }, 500, cors);
    }

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: "Invalid JSON" }, 400, cors); }

    const wantStream = body.stream === true;
    const payload = {
      max_tokens: Math.min(Number(body.max_tokens) || 1000, 1024),
      system: typeof body.system === "string" ? body.system : "",
      messages: Array.isArray(body.messages) ? body.messages : []
    };
    if (wantStream) payload.stream = true;

    const first = pickModel(body, env);
    /* 關掉「先思考」：max_tokens 只有 1024，模型若先花掉額度思考，就會回空字串（前端看到「回覆是空的」）。
       若上游不接受這個欄位（400 且訊息提到 thinking），自動拿掉再送一次。 */
    function send(model, withThinking) {
      const p = Object.assign({ model: model }, payload);
      if (withThinking) p.thinking = { type: "disabled" };
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(p)
      });
    }
    async function call(model) {
      const r = await send(model, true);
      if (r.status === 400) {
        let t = ""; try { t = await r.clone().text(); } catch (e) {}
        if (/thinking/i.test(t)) return send(model, false);
      }
      return r;
    }
    /* 試一個模型：成功或「換模型也沒用的錯誤（如 400）」→ 直接收下；429／5xx／連不上 → 標記可換 */
    async function attempt(model) {
      try {
        const r = await call(model);
        return { r: r, model: model, retry: !r.ok && !!RETRY_STATUS[r.status] };
      } catch (e) { return { err: e, model: model, retry: true }; }
    }
    async function respond(a, fb) {
      const h = Object.assign({}, cors, { "X-XZ-Model": a.model, "X-XZ-Fallback": fb ? "1" : "0" });
      if (wantStream && a.r.ok && a.r.body) {
        /* 逐字顯示：把上游的 SSE 原封不動接給前端，不緩衝 */
        return new Response(a.r.body, { status: 200, headers: Object.assign(h, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" }) });
      }
      const text = await a.r.text();
      return new Response(text, { status: a.r.status, headers: Object.assign(h, { "Content-Type": "application/json" }) });
    }

    let a = await attempt(first), fb = false;
    if (a.retry) {
      const b2 = await attempt(otherModel(first));
      if (b2.r && b2.r.ok) { a = b2; fb = true; }
      else if (!a.r) {                                  // 第一次根本連不上：以第二次的結果為準
        if (!b2.r) return json({ error: "Upstream error", detail: String(a.err) + " | " + String(b2.err) }, 502, cors);
        a = b2; fb = true;
      }
    }
    if (!a.r) return json({ error: "Upstream error", detail: String(a.err) }, 502, cors);
    return respond(a, fb);
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({}, cors, { "Content-Type": "application/json" })
  });
}
