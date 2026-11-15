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

    const payload = {
      max_tokens: Math.min(Number(body.max_tokens) || 1000, 1024),
      system: typeof body.system === "string" ? body.system : "",
      messages: Array.isArray(body.messages) ? body.messages : []
    };

    const first = pickModel(body, env);
    async function call(model) {
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(Object.assign({ model: model }, payload))
      });
    }
    function reply(upstream, text, model, fb) {
      return new Response(text, {
        status: upstream.status,
        headers: Object.assign({}, cors, { "Content-Type": "application/json", "X-XZ-Model": model, "X-XZ-Fallback": fb ? "1" : "0" })
      });
    }

    let up = null, text = "", err1 = null;
    try {
      up = await call(first);
      text = await up.text();
    } catch (e) { err1 = e; }

    if (err1 || (up && RETRY_STATUS[up.status])) {
      const second = otherModel(first);
      try {
        const up2 = await call(second);
        const text2 = await up2.text();
        if (up2.ok) return reply(up2, text2, second, true);
        if (!up) return reply(up2, text2, second, true);   // 第一次連線就失敗、第二次回了錯誤：回第二次的錯誤
      } catch (e2) {
        if (!up) return json({ error: "Upstream error", detail: String(err1) + " | " + String(e2) }, 502, cors);
      }
    }
    if (!up) return json({ error: "Upstream error", detail: String(err1) }, 502, cors);
    return reply(up, text, first, false);
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({}, cors, { "Content-Type": "application/json" })
  });
}
