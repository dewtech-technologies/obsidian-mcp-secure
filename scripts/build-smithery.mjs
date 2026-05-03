/**
 * Build script para gerar o bundle MCPB específico para o Smithery.
 *
 * O mcpb validator rejeita inputSchema/outputSchema nos tools,
 * então criamos o ZIP manualmente com o manifest completo para Smithery.
 */

import { execSync }                               from "child_process";
import { cpSync, mkdirSync, rmSync, existsSync,
         readFileSync, writeFileSync, statSync }  from "fs";
import { join, resolve, dirname }                  from "path";
import { fileURLToPath }                           from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "..");
const dist      = join(root, ".smithery-build");
const output    = join(root, "obsidian-mcp-secure.mcpb");
const pkg       = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));

// ── Limpa build anterior ─────────────────────────────────────────────────────
if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

// ── Copia arquivos de produção ───────────────────────────────────────────────
console.log("📂  Copiando arquivos de produção...");
cpSync(join(root, "src"),           join(dist, "src"),          { recursive: true });
cpSync(join(root, ".env.example"),  join(dist, ".env.example"));
cpSync(join(root, "README.md"),     join(dist, "README.md"));
cpSync(join(root, "LICENSE"),       join(dist, "LICENSE"));

writeFileSync(join(dist, "package.json"), JSON.stringify({
  name: pkg.name, version: pkg.version,
  type: pkg.type, dependencies: pkg.dependencies, engines: pkg.engines,
}, null, 2));

// ── Manifest completo para Smithery ─────────────────────────────────────────
console.log("📝  Gerando manifest Smithery com inputSchema + outputSchema + annotations...");

const tools = [
  {
    name: "read_note",
    description: "Read the full content of an Obsidian note by its vault path.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      type: "object", required: ["path"],
      properties: {
        path: { type: "string", description: "Vault-relative path to the note, e.g. 'Projetos/MyNote.md'" }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Full Markdown content of the note" }
      }
    }
  },
  {
    name: "list_notes",
    description: "List all files and folders inside the vault or a specific subdirectory.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        directory: { type: "string", description: "Subdirectory to list. Leave empty to list the vault root.", default: "" }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        files: { type: "array", items: { type: "string" }, description: "List of file and folder paths" }
      }
    }
  },
  {
    name: "create_note",
    description: "Create a new Markdown note at the given vault path.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    inputSchema: {
      type: "object", required: ["path", "content"],
      properties: {
        path:    { type: "string", description: "Vault-relative path for the new note, e.g. 'Projetos/New.md'" },
        content: { type: "string", description: "Markdown content to write into the note" }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Confirmation message with the created note path" }
      }
    }
  },
  {
    name: "edit_note",
    description: "Overwrite the entire content of an existing note. The previous content is preserved in the audit log.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      type: "object", required: ["path", "content"],
      properties: {
        path:    { type: "string", description: "Vault-relative path of the note to edit, e.g. 'Projetos/MyNote.md'" },
        content: { type: "string", description: "New Markdown content that will replace the current content" }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Confirmation message with the updated note path" }
      }
    }
  },
  {
    name: "delete_note",
    description: "Permanently delete a note from the vault. Requires explicit confirmation.",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    inputSchema: {
      type: "object", required: ["path", "confirm"],
      properties: {
        path:    { type: "string",  description: "Vault-relative path of the note to delete, e.g. 'Projetos/MyNote.md'" },
        confirm: { type: "boolean", description: "Must be set to true to confirm the irreversible deletion", enum: [true] }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Confirmation message after successful deletion" }
      }
    }
  },
  {
    name: "search_notes",
    description: "Full-text and tag search across the entire vault using Obsidian's built-in search engine.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      type: "object", required: ["query"],
      properties: {
        query: { type: "string",  description: "Search term or tag to look for, e.g. '#project' or 'meeting notes'" },
        limit: { type: "number",  description: "Maximum number of results to return (1–50)", minimum: 1, maximum: 50, default: 20 }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path:    { type: "string", description: "Vault path of the matching note" },
              excerpt: { type: "string", description: "Text excerpt around the match" }
            }
          }
        }
      }
    }
  },
  {
    name: "find_note_by_name",
    description: "Find notes by a partial name or folder keyword — case-insensitive, searches the full path including folder names.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      type: "object", required: ["name"],
      properties: {
        name:  { type: "string", description: "Partial note name or folder to search for, e.g. 'pentest' or 'API'" },
        limit: { type: "number", description: "Maximum number of results to return (1–50)", minimum: 1, maximum: 50, default: 20 }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        matches: { type: "array", items: { type: "string" }, description: "List of vault paths that match the search term" }
      }
    }
  },
  {
    name: "list_tags",
    description: "List all tags used across the vault with their occurrence count. Sortable by name or frequency.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        sort: { type: "string", description: "Sort order: 'name' (alphabetical) or 'count' (most used first)", enum: ["name", "count"], default: "name" }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tag:   { type: "string", description: "Tag name including the # prefix" },
              count: { type: "number", description: "Number of notes using this tag" }
            }
          }
        }
      }
    }
  },
  {
    name: "create_backlinks",
    description: "Add [[wikilinks]] pointing to related notes inside a '## Relacionadas' section of the source note. Creates the section if it doesn't exist.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      type: "object", required: ["source_path", "target_paths"],
      properties: {
        source_path:  { type: "string", description: "Vault path of the note that will receive the backlinks, e.g. 'Projetos/Project.md'" },
        target_paths: { type: "array", items: { type: "string" }, minItems: 1, description: "List of vault paths to link to, e.g. ['Concepts/API.md', 'Meetings/2026-01.md']" }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Confirmation message listing the backlinks added" }
      }
    }
  }
];

const manifest = {
  manifest_version: "0.3",
  name:         "obsidian-mcp-secure",
  display_name: "Obsidian MCP Secure",
  version:      pkg.version,
  description:  "Secure MCP server that connects Claude Desktop to your Obsidian vault — OWASP Top 10 controls, Zod input validation, 512 KB payload limits, localhost-only, and full audit logging.",
  long_description: "Bridge between Claude Desktop and Obsidian via the Local REST API plugin. Provides 9 tools (read, list, create, edit, delete, search, find by name, list tags, create backlinks) with path traversal blocking, Zod input validation, 512 KB payload limits, localhost-only connections, and a full audit log with size-based rotation.",
  author: {
    name:  "Wanderson Leandro",
    email: "wleandro.oliveira@gmail.com",
    url:   "https://github.com/wleandrooliveira"
  },
  repository: { type: "git", url: "https://github.com/dewtech-technologies/obsidian-mcp-secure" },
  homepage:      "https://github.com/dewtech-technologies/obsidian-mcp-secure#readme",
  documentation: "https://github.com/dewtech-technologies/obsidian-mcp-secure#readme",
  support:       "https://github.com/dewtech-technologies/obsidian-mcp-secure/issues",
  license: "MIT",
  keywords: ["obsidian", "mcp", "second-brain", "notes", "owasp", "security", "vault", "knowledge-base"],
  server: {
    type: "node",
    entry_point: "src/server.js",
    mcp_config: {
      command: "node",
      args:    ["${__dirname}/src/server.js"],
      env: {
        OBSIDIAN_API_KEY: "${user_config.api_key}",
        OBSIDIAN_HOST:    "${user_config.host}",
        OBSIDIAN_PORT:    "${user_config.port}"
      }
    }
  },
  tools,
  user_config: {
    api_key: {
      type: "string", title: "Obsidian API Key", sensitive: true, required: true,
      description: "API key from the Local REST API plugin (Obsidian → Settings → Community Plugins → Local REST API → copy the key)"
    },
    host: {
      type: "string", title: "Obsidian Host", required: false, default: "http://127.0.0.1",
      description: "Host for the Obsidian Local REST API. Only http://127.0.0.1 and http://localhost are accepted."
    },
    port: {
      type: "number", title: "Obsidian Port", required: false, default: 27123,
      min: 1, max: 65535,
      description: "Port for the Obsidian Local REST API plugin (default: 27123)."
    }
  },
  compatibility: {
    claude_desktop: ">=0.10.0",
    platforms: ["darwin", "win32", "linux"],
    runtimes:  { node: ">=18.0.0" }
  },
  privacy_policies: []
};

writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));

// ── Instala apenas deps de produção ─────────────────────────────────────────
console.log("📦  Instalando dependências de produção...");
execSync("npm install --omit=dev --ignore-scripts", { cwd: dist, stdio: "inherit" });

// ── Cria ZIP manualmente (contorna validador mcpb que rejeita inputSchema) ───
console.log("🗜   Empacotando MCPB para Smithery...");
const { default: AdmZip } = await import("adm-zip");
const zip = new AdmZip();
zip.addLocalFolder(dist);
zip.writeZip(output);

// ── Limpeza ───────────────────────────────────────────────────────────────────
rmSync(dist, { recursive: true, force: true });

const sizeKB = (statSync(output).size / 1024).toFixed(1);
console.log(`\n✨  obsidian-mcp-secure.mcpb (Smithery) gerado — ${sizeKB} KB`);
