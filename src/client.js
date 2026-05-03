/**
 * HTTP client para a API REST local do Obsidian.
 * Controles: A02 (API key via env), A05 (localhost-only).
 */

import "dotenv/config";

const CONFIG = {
  apiKey: process.env.OBSIDIAN_API_KEY,
  host:   process.env.OBSIDIAN_HOST || "http://127.0.0.1",
  port:   parseInt(process.env.OBSIDIAN_PORT || "27123"),
};

// Remove API key de logs acidentais (A02)
export function sanitizeForLog(obj) {
  const str = JSON.stringify(obj || {});
  return JSON.parse(str.replace(/sk-[a-zA-Z0-9-]+/g, "[REDACTED]"));
}

// Se body for string envia como text/markdown; se for objeto, como application/json.
export async function obsidianRequest(method, endpoint, body = null) {
  const url = `${CONFIG.host}:${CONFIG.port}${endpoint}`;

  // Valida que a URL é apenas localhost (A05)
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error("Host não permitido — apenas localhost (A05)");
  }

  const isRawString = typeof body === "string";
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${CONFIG.apiKey}`,
      "Content-Type": isRawString ? "text/markdown" : "application/json",
    },
  };

  if (body !== null && body !== undefined) {
    options.body = isRawString ? body : JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Obsidian API erro ${res.status}: ${text.slice(0, 200)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}
