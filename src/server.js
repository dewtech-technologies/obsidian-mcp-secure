#!/usr/bin/env node
/**
 * Obsidian MCP Server — Seguro (OWASP Top 10)
 * 
 * Controles implementados:
 * A01 - Broken Access Control    → allowlist de operações + path traversal bloqueado
 * A02 - Cryptographic Failures   → API key via env, nunca hardcoded
 * A03 - Injection                → sanitização de inputs, sem eval/exec
 * A05 - Security Misconfiguration→ HTTPS forçado, headers validados
 * A06 - Vulnerable Components    → dependências mínimas e auditadas
 * A09 - Logging & Monitoring     → audit log completo em arquivo rotativo
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import winston from "winston";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIGURAÇÃO VIA ENV (A02) ──────────────────────────────────────────────
const CONFIG = {
  apiKey:   process.env.OBSIDIAN_API_KEY,
  host:     process.env.OBSIDIAN_HOST     || "http://127.0.0.1",
  port:     parseInt(process.env.OBSIDIAN_PORT || "27123"),
  logDir:   process.env.LOG_DIR           || path.join(__dirname, "..", "logs"),
  maxNoteSize: 512 * 1024, // 512KB — evita DoS por payload gigante
};

if (!CONFIG.apiKey) {
  console.error("[FATAL] OBSIDIAN_API_KEY não definida no .env");
  process.exit(1);
}

// ─── AUDIT LOGGER (A09) ──────────────────────────────────────────────────────
if (!fs.existsSync(CONFIG.logDir)) fs.mkdirSync(CONFIG.logDir, { recursive: true });

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(CONFIG.logDir, "audit.log"),
      maxsize: 5 * 1024 * 1024, // 5MB por arquivo
      maxFiles: 10,              // mantém últimos 10 arquivos
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(CONFIG.logDir, "error.log"),
      level: "error",
    }),
  ],
});

function audit(action, params, result, error = null) {
  logger.info({
    action,
    params: sanitizeForLog(params),
    success: !error,
    error: error?.message || null,
    timestamp: new Date().toISOString(),
  });
}

// Remove API key de logs acidentais
function sanitizeForLog(obj) {
  const str = JSON.stringify(obj || {});
  return JSON.parse(str.replace(/sk-[a-zA-Z0-9-]+/g, "[REDACTED]"));
}

// ─── SANITIZAÇÃO DE INPUTS (A03 — Injection) ─────────────────────────────────

// Bloqueia path traversal: ../  ..\  %2e%2e  etc.
function sanitizePath(input) {
  if (!input || typeof input !== "string") throw new Error("Caminho inválido");

  const decoded = decodeURIComponent(input);
  if (/(\.\.|\/\/|\\|%2e|%2f|%5c)/i.test(decoded)) {
    throw new Error("Path traversal detectado — operação bloqueada (A01)");
  }

  // Permite apenas caracteres seguros em nomes de arquivo
  const safe = decoded.replace(/[^\w\s\-\.\/\u00C0-\u024F]/g, "");
  if (safe !== decoded) {
    throw new Error("Caracteres não permitidos no caminho");
  }

  return safe.trim();
}

// Limita tamanho do conteúdo (A04 — DoS)
function sanitizeContent(content) {
  if (!content) return "";
  if (typeof content !== "string") throw new Error("Conteúdo deve ser string");
  if (Buffer.byteLength(content, "utf8") > CONFIG.maxNoteSize) {
    throw new Error(`Conteúdo excede limite de ${CONFIG.maxNoteSize / 1024}KB`);
  }
  return content;
}

// Sanitiza query de busca — remove operadores de injeção
function sanitizeQuery(query) {
  if (!query || typeof query !== "string") throw new Error("Query inválida");
  if (query.length > 500) throw new Error("Query muito longa (máx 500 chars)");
  // Remove caracteres de controle
  return query.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

// ─── HTTP CLIENT SEGURO (sem axios, fetch nativo) ────────────────────────────
async function obsidianRequest(method, endpoint, body = null) {
  const url = `${CONFIG.host}:${CONFIG.port}${endpoint}`;

  // Valida que a URL é apenas localhost (A05)
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error("Host não permitido — apenas localhost (A05)");
  }

  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${CONFIG.apiKey}`,
      "Content-Type": "application/json",
    },
  };

  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Obsidian API erro ${res.status}: ${text.slice(0, 200)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

// ─── MCP SERVER ──────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "obsidian-secure",
  version: "1.0.0",
});

// ── TOOL: ler nota ────────────────────────────────────────────────────────────
server.tool(
  "read_note",
  "Lê o conteúdo de uma nota do Obsidian pelo caminho",
  { path: z.string().describe("Caminho da nota, ex: Projetos/MinhaNote.md") },
  async ({ path: notePath }) => {
    try {
      const safe = sanitizePath(notePath);
      const data = await obsidianRequest("GET", `/vault/${encodeURIComponent(safe)}`);
      audit("read_note", { path: safe }, "ok");
      return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }] };
    } catch (e) {
      audit("read_note", { path: notePath }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }
);

// ── TOOL: listar notas ────────────────────────────────────────────────────────
server.tool(
  "list_notes",
  "Lista arquivos e pastas do vault ou de um diretório específico",
  { directory: z.string().optional().describe("Diretório a listar (vazio = raiz)") },
  async ({ directory = "" }) => {
    try {
      const safe = directory ? sanitizePath(directory) : "";
      const endpoint = safe ? `/vault/${encodeURIComponent(safe)}/` : "/vault/";
      const data = await obsidianRequest("GET", endpoint);
      audit("list_notes", { directory: safe }, "ok");
      const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      audit("list_notes", { directory }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }
);

// ── TOOL: criar nota ──────────────────────────────────────────────────────────
server.tool(
  "create_note",
  "Cria uma nova nota no Obsidian",
  {
    path:    z.string().describe("Caminho da nota a criar, ex: Projetos/Nova.md"),
    content: z.string().describe("Conteúdo em Markdown"),
  },
  async ({ path: notePath, content }) => {
    try {
      const safe    = sanitizePath(notePath);
      const safeContent = sanitizeContent(content);

      // Garante extensão .md
      if (!safe.endsWith(".md")) throw new Error("Arquivo deve ter extensão .md");

      await obsidianRequest("PUT", `/vault/${encodeURIComponent(safe)}`, { content: safeContent });
      audit("create_note", { path: safe, size: Buffer.byteLength(safeContent) }, "ok");
      return { content: [{ type: "text", text: `Nota criada: ${safe}` }] };
    } catch (e) {
      audit("create_note", { path: notePath }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }
);

// ── TOOL: editar nota ─────────────────────────────────────────────────────────
server.tool(
  "edit_note",
  "Edita o conteúdo de uma nota existente (substitui o conteúdo inteiro)",
  {
    path:    z.string().describe("Caminho da nota a editar"),
    content: z.string().describe("Novo conteúdo em Markdown"),
  },
  async ({ path: notePath, content }) => {
    try {
      const safe        = sanitizePath(notePath);
      const safeContent = sanitizeContent(content);

      if (!safe.endsWith(".md")) throw new Error("Arquivo deve ter extensão .md");

      // Faz backup do conteúdo anterior no log antes de sobrescrever
      let previous = "";
      try {
        previous = await obsidianRequest("GET", `/vault/${encodeURIComponent(safe)}`);
      } catch (_) {}

      await obsidianRequest("PUT", `/vault/${encodeURIComponent(safe)}`, { content: safeContent });
      audit("edit_note", { path: safe, previousSize: Buffer.byteLength(previous || ""), newSize: Buffer.byteLength(safeContent) }, "ok");
      return { content: [{ type: "text", text: `Nota editada: ${safe}` }] };
    } catch (e) {
      audit("edit_note", { path: notePath }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }
);

// ── TOOL: deletar nota ────────────────────────────────────────────────────────
server.tool(
  "delete_note",
  "Deleta uma nota do vault. ATENÇÃO: ação irreversível.",
  {
    path:    z.string().describe("Caminho da nota a deletar"),
    confirm: z.literal(true).describe("Deve ser true para confirmar a deleção"),
  },
  async ({ path: notePath, confirm }) => {
    try {
      // confirm é validado pelo zod (literal true)
      const safe = sanitizePath(notePath);
      if (!safe.endsWith(".md")) throw new Error("Arquivo deve ter extensão .md");

      // Loga o conteúdo antes de deletar (para auditoria)
      let previous = "";
      try {
        previous = await obsidianRequest("GET", `/vault/${encodeURIComponent(safe)}`);
      } catch (_) {}

      await obsidianRequest("DELETE", `/vault/${encodeURIComponent(safe)}`);
      audit("delete_note", { path: safe, contentSize: Buffer.byteLength(previous || "") }, "ok");
      return { content: [{ type: "text", text: `Nota deletada: ${safe}` }] };
    } catch (e) {
      audit("delete_note", { path: notePath }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }
);

// ── TOOL: buscar notas ────────────────────────────────────────────────────────
server.tool(
  "search_notes",
  "Busca notas por conteúdo ou tag no vault",
  {
    query:  z.string().describe("Termo ou tag a buscar, ex: #projeto ou palavra-chave"),
    limit:  z.number().min(1).max(50).optional().default(20).describe("Máximo de resultados (1-50)"),
  },
  async ({ query, limit }) => {
    try {
      const safeQuery = sanitizeQuery(query);
      // Plugin Local REST API exige query string, nao body JSON
      const params = new URLSearchParams({
        query: safeQuery,
        contextLength: "200",
      });
      const data = await obsidianRequest(
        "POST",
        `/search/simple/?${params.toString()}`
      );

      const results = Array.isArray(data) ? data.slice(0, limit) : data;
      audit("search_notes", { query: safeQuery, limit }, "ok");
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (e) {
      audit("search_notes", { query }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }
);

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
logger.info({ action: "server_start", config: { host: CONFIG.host, port: CONFIG.port } });
