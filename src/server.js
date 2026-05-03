#!/usr/bin/env node
/**
 * Obsidian MCP Server — Seguro (OWASP Top 10)
 *
 * A01 - Broken Access Control    → allowlist de operações + path traversal bloqueado
 * A02 - Cryptographic Failures   → API key via env, nunca hardcoded
 * A03 - Injection                → sanitização de inputs, sem eval/exec
 * A04 - Insecure Design          → limite de tamanho, confirm explícito em delete
 * A05 - Security Misconfiguration→ localhost-only, headers validados
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

import { obsidianRequest, sanitizeForLog } from "./client.js";
import { makeHandlers } from "./handlers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIGURAÇÃO VIA ENV (A02) ──────────────────────────────────────────────
const CONFIG = {
  apiKey:  process.env.OBSIDIAN_API_KEY,
  host:    process.env.OBSIDIAN_HOST || "http://127.0.0.1",
  port:    parseInt(process.env.OBSIDIAN_PORT || "27123"),
  logDir:  process.env.LOG_DIR || path.join(__dirname, "..", "logs"),
};

// A02: API key é obrigatória para chamadas reais, mas não crashamos no startup
// para que scanners/introspectores MCP (ex: Smithery) consigam listar as tools.
// O handler lança erro se a key não estiver presente quando a tool é chamada.
const MISSING_API_KEY = !CONFIG.apiKey;

// ─── AUDIT LOGGER (A09) ──────────────────────────────────────────────────────
if (!fs.existsSync(CONFIG.logDir)) fs.mkdirSync(CONFIG.logDir, { recursive: true });

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({
      filename: path.join(CONFIG.logDir, "audit.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 10,
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

// ─── TOOLS ───────────────────────────────────────────────────────────────────
const h = makeHandlers(obsidianRequest, audit);

const server = new McpServer({ name: "obsidian-secure", version: "1.1.0" });

server.tool(
  "read_note",
  "Lê o conteúdo de uma nota do Obsidian pelo caminho",
  { path: z.string().describe("Caminho da nota, ex: Projetos/MinhaNote.md") },
  h.read_note
);

server.tool(
  "list_notes",
  "Lista arquivos e pastas do vault ou de um diretório específico",
  { directory: z.string().optional().describe("Diretório a listar (vazio = raiz)") },
  h.list_notes
);

server.tool(
  "create_note",
  "Cria uma nova nota no Obsidian",
  {
    path:    z.string().describe("Caminho da nota a criar, ex: Projetos/Nova.md"),
    content: z.string().describe("Conteúdo em Markdown"),
  },
  h.create_note
);

server.tool(
  "edit_note",
  "Edita o conteúdo de uma nota existente (substitui o conteúdo inteiro)",
  {
    path:    z.string().describe("Caminho da nota a editar"),
    content: z.string().describe("Novo conteúdo em Markdown"),
  },
  h.edit_note
);

server.tool(
  "delete_note",
  "Deleta uma nota do vault. ATENÇÃO: ação irreversível.",
  {
    path:    z.string().describe("Caminho da nota a deletar"),
    confirm: z.literal(true).describe("Deve ser true para confirmar a deleção"),
  },
  h.delete_note
);

server.tool(
  "search_notes",
  "Busca notas por conteúdo ou tag no vault",
  {
    query: z.string().describe("Termo ou tag a buscar, ex: #projeto ou palavra-chave"),
    limit: z.number().min(1).max(50).optional().default(20).describe("Máximo de resultados (1-50)"),
  },
  h.search_notes
);

server.tool(
  "find_note_by_name",
  "Encontra notas pelo nome (busca parcial, insensível a maiúsculas). Útil quando o caminho exato não é conhecido.",
  {
    name:  z.string().describe("Parte do nome da nota a buscar, ex: 'reunião' ou 'API'"),
    limit: z.number().min(1).max(50).optional().default(20).describe("Máximo de resultados"),
  },
  h.find_note_by_name
);

server.tool(
  "list_tags",
  "Lista todas as tags usadas no vault com contagem de ocorrências",
  {
    sort: z.enum(["name", "count"]).optional().default("name")
      .describe("Ordenar por nome (name) ou por frequência (count)"),
  },
  h.list_tags
);

server.tool(
  "create_backlinks",
  "Adiciona wikilinks [[NomeDaNota]] na seção '## Relacionadas' da nota source. Cria a seção se não existir.",
  {
    source_path:  z.string().describe("Nota que receberá os backlinks, ex: Projetos/Projeto.md"),
    target_paths: z.array(z.string()).min(1)
      .describe("Lista de notas a vincular, ex: ['Conceitos/API.md', 'Reunioes/2026-01.md']"),
  },
  h.create_backlinks
);

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
logger.info({ action: "server_start", config: { host: CONFIG.host, port: CONFIG.port } });
