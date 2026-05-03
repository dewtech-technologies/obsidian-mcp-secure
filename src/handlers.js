/**
 * Handlers das tools MCP — recebem (request, audit) via injeção de dependência
 * para facilitar testes unitários sem depender da API do Obsidian.
 *
 * request: (method, endpoint, body?) => Promise<any>
 * audit:   (action, params, result, error?) => void
 */

import { sanitizePath, sanitizeContent, sanitizeQuery } from "./utils.js";

export function makeHandlers(request, audit) {
  // ── read_note ────────────────────────────────────────────────────────────────
  async function read_note({ path: notePath }) {
    try {
      const safe = sanitizePath(notePath);
      const data = await request("GET", `/vault/${encodeURIComponent(safe)}`);
      const text =
        typeof data === "string"
          ? data
          : typeof data?.content === "string"
          ? data.content
          : JSON.stringify(data);
      audit("read_note", { path: safe }, "ok");
      return { content: [{ type: "text", text }] };
    } catch (e) {
      audit("read_note", { path: notePath }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  // ── list_notes ───────────────────────────────────────────────────────────────
  async function list_notes({ directory = "" }) {
    try {
      const safe = directory ? sanitizePath(directory) : "";
      const endpoint = safe ? `/vault/${encodeURIComponent(safe)}/` : "/vault/";
      const data = await request("GET", endpoint);
      audit("list_notes", { directory: safe }, "ok");
      const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      audit("list_notes", { directory }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  // ── create_note ──────────────────────────────────────────────────────────────
  async function create_note({ path: notePath, content }) {
    try {
      const safe = sanitizePath(notePath);
      const safeContent = sanitizeContent(content);
      if (!safe.endsWith(".md")) throw new Error("Arquivo deve ter extensão .md");
      await request("PUT", `/vault/${encodeURIComponent(safe)}`, safeContent);
      audit("create_note", { path: safe, size: Buffer.byteLength(safeContent) }, "ok");
      return { content: [{ type: "text", text: `Nota criada: ${safe}` }] };
    } catch (e) {
      audit("create_note", { path: notePath }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  // ── edit_note ────────────────────────────────────────────────────────────────
  async function edit_note({ path: notePath, content }) {
    try {
      const safe = sanitizePath(notePath);
      const safeContent = sanitizeContent(content);
      if (!safe.endsWith(".md")) throw new Error("Arquivo deve ter extensão .md");

      let previous = "";
      try {
        previous = await request("GET", `/vault/${encodeURIComponent(safe)}`);
      } catch (_) {}

      await request("PUT", `/vault/${encodeURIComponent(safe)}`, safeContent);
      audit("edit_note", {
        path: safe,
        previousSize: Buffer.byteLength(previous || ""),
        newSize: Buffer.byteLength(safeContent),
      }, "ok");
      return { content: [{ type: "text", text: `Nota editada: ${safe}` }] };
    } catch (e) {
      audit("edit_note", { path: notePath }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  // ── delete_note ──────────────────────────────────────────────────────────────
  async function delete_note({ path: notePath }) {
    try {
      const safe = sanitizePath(notePath);
      if (!safe.endsWith(".md")) throw new Error("Arquivo deve ter extensão .md");

      let previous = "";
      try {
        previous = await request("GET", `/vault/${encodeURIComponent(safe)}`);
      } catch (_) {}

      await request("DELETE", `/vault/${encodeURIComponent(safe)}`);
      audit("delete_note", { path: safe, contentSize: Buffer.byteLength(previous || "") }, "ok");
      return { content: [{ type: "text", text: `Nota deletada: ${safe}` }] };
    } catch (e) {
      audit("delete_note", { path: notePath }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  // ── search_notes ─────────────────────────────────────────────────────────────
  async function search_notes({ query, limit }) {
    try {
      const safeQuery = sanitizeQuery(query);
      const params = new URLSearchParams({ query: safeQuery, contextLength: "200" });
      const data = await request("POST", `/search/simple/?${params.toString()}`);
      const results = Array.isArray(data) ? data.slice(0, limit) : data;
      audit("search_notes", { query: safeQuery, limit }, "ok");
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (e) {
      audit("search_notes", { query }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  // ── find_note_by_name ─────────────────────────────────────────────────────────
  // GET /vault/ retorna { files: ["path/to/Note.md", ...] } — lista recursiva de
  // todos os arquivos do vault. Busca no path completo (pasta + nome do arquivo).
  async function find_note_by_name({ name, limit }) {
    try {
      const safeName = sanitizeQuery(name);
      const data = await request("GET", "/vault/");

      let files = [];
      if (Array.isArray(data?.files)) {
        files = data.files;
      } else if (Array.isArray(data)) {
        files = data;
      } else if (typeof data === "string") {
        try { files = JSON.parse(data)?.files || []; } catch (_) {}
      }

      const lower = safeName.toLowerCase();
      const matches = files
        .filter((f) => typeof f === "string" && f.toLowerCase().includes(lower))
        .slice(0, limit);

      audit("find_note_by_name", { name: safeName, limit, found: matches.length }, "ok");

      const text =
        matches.length > 0
          ? matches.join("\n")
          : "Nenhuma nota encontrada com esse nome.";
      return { content: [{ type: "text", text }] };
    } catch (e) {
      audit("find_note_by_name", { name }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  // ── list_tags ─────────────────────────────────────────────────────────────────
  // GET /tags/ pode retornar:
  //   • objeto  { "#tag": count, ... }            — Local REST API v1
  //   • array   [{ tag, tagCount, ... }, ...]     — Local REST API v2+
  //   • array   ["#tag", ...]                     — versões antigas
  async function list_tags({ sort = "name" }) {
    try {
      const data = await request("GET", "/tags/");

      let tags = [];
      if (data && typeof data === "object" && !Array.isArray(data)) {
        // Formato objeto { "#tag": count }
        tags = Object.entries(data).map(([tag, count]) => ({ tag, count }));
      } else if (Array.isArray(data)) {
        tags = data.map((t) => {
          if (typeof t === "string") return { tag: t, count: null };
          // Normaliza campos de diferentes versões da API
          const tag   = t.tag ?? t.name ?? t.tagName ?? t.label ?? Object.keys(t)[0] ?? "";
          const count = t.count ?? t.tagCount ?? t.taggedFilesCount ?? t.frequency ?? null;
          return { tag, count };
        });
      }

      if (sort === "count") {
        tags.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
      } else {
        tags.sort((a, b) => a.tag.localeCompare(b.tag));
      }

      audit("list_tags", { sort, found: tags.length }, "ok");

      const text =
        tags.length > 0
          ? tags.map((t) => (t.count != null ? `${t.tag} (${t.count})` : t.tag)).join("\n")
          : "Nenhuma tag encontrada no vault.";
      return { content: [{ type: "text", text }] };
    } catch (e) {
      audit("list_tags", { sort }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  // ── create_backlinks ──────────────────────────────────────────────────────────
  // Lê a nota source e adiciona/atualiza uma seção "## Relacionadas" com
  // wikilinks [[NomeDaNota]] para cada target_path fornecido.
  async function create_backlinks({ source_path, target_paths }) {
    try {
      if (!Array.isArray(target_paths) || target_paths.length === 0) {
        throw new Error("target_paths deve ser um array não-vazio");
      }

      const safeSrc = sanitizePath(source_path);
      if (!safeSrc.endsWith(".md")) throw new Error("source_path deve ter extensão .md");

      const safeTargets = target_paths.map((t) => {
        const s = sanitizePath(t);
        if (!s.endsWith(".md")) throw new Error(`target deve ter extensão .md: ${t}`);
        return s;
      });

      const rawSource = await request("GET", `/vault/${encodeURIComponent(safeSrc)}`);
      const sourceContent =
        typeof rawSource === "string" ? rawSource : rawSource?.content ?? "";

      const wikilinks = safeTargets
        .map((t) => {
          const name = t.replace(/\.md$/, "").split("/").pop();
          return `- [[${name}]]`;
        })
        .join("\n");

      const SECTION = "## Relacionadas";
      let updated;

      if (sourceContent.includes(SECTION)) {
        // Append dentro da seção existente (antes da próxima ## ou fim do arquivo)
        updated = sourceContent.replace(
          /(## Relacionadas[\s\S]*?)(\n##|$)/,
          (_, section, next) => `${section.trimEnd()}\n${wikilinks}${next}`
        );
      } else {
        updated = `${sourceContent.trimEnd()}\n\n${SECTION}\n${wikilinks}\n`;
      }

      await request("PUT", `/vault/${encodeURIComponent(safeSrc)}`, updated);
      audit("create_backlinks", { source: safeSrc, targets: safeTargets.length }, "ok");
      return {
        content: [{ type: "text", text: `Backlinks adicionados em: ${safeSrc}` }],
      };
    } catch (e) {
      audit("create_backlinks", { source_path }, null, e);
      return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
    }
  }

  return {
    read_note,
    list_notes,
    create_note,
    edit_note,
    delete_note,
    search_notes,
    find_note_by_name,
    list_tags,
    create_backlinks,
  };
}
