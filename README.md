# obsidian-mcp-secure

[![npm version](https://img.shields.io/npm/v/obsidian-mcp-secure?color=CB3837&logo=npm)](https://www.npmjs.com/package/obsidian-mcp-secure)
[![npm downloads](https://img.shields.io/npm/dm/obsidian-mcp-secure)](https://www.npmjs.com/package/obsidian-mcp-secure)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-5A67D8)](https://registry.modelcontextprotocol.io)
[![license](https://img.shields.io/npm/l/obsidian-mcp-secure)](LICENSE)
[![npm audit](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)](package.json)
[![CI](https://github.com/dewtech-technologies/obsidian-mcp-secure/actions/workflows/ci.yml/badge.svg)](https://github.com/dewtech-technologies/obsidian-mcp-secure/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-unit%20tested-brightgreen)](test/)
[![Smithery](https://smithery.ai/badge/wleandro-oliveira/obsidian-mcp-secure)](https://smithery.ai/servers/wleandro-oliveira/obsidian-mcp-secure)

> Secure Model Context Protocol server that turns your Obsidian vault into a reliable data source for any MCP-compatible AI client — built from scratch with OWASP Top 10 controls and full audit logging.

Listed on the [official Anthropic MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.dewtech-technologies/obsidian-mcp-secure`.

---

## 🧭 Positioning — this is NOT a plugin for Obsidian

It's the opposite: it's a **bridge that lets Claude Desktop (or any MCP client) read and write inside Obsidian safely**. Your AI assistant stays where it lives; your vault becomes a structured, auditable datasource it can reach.

```
┌─────────────────┐   MCP    ┌──────────────────────┐   HTTP   ┌────────────────────┐   FS   ┌─────────────┐
│                 │  stdio   │                      │  :27123  │                    │        │             │
│ Claude Desktop  │ ───────▶ │ obsidian-mcp-secure  │ ───────▶ │  Local REST API    │ ─────▶ │  Vault .md  │
│  (AI client)    │          │  (this package)      │          │ (Obsidian plugin)  │        │             │
└─────────────────┘          └──────────────────────┘          └────────────────────┘        └─────────────┘
```

| Role in the pipeline | Component |
|---|---|
| Where you talk | **Claude Desktop** (or any MCP client) |
| Bridge / access control | **`obsidian-mcp-secure`** (this package) |
| Data gateway inside Obsidian | **Local REST API plugin** (by Adam Coddington) |
| Your knowledge | `.md` files in your vault |

**One-liner:** *Claude is the brain, this MCP is the arm, Obsidian is the memory.*

### Why another Obsidian + AI integration?

There are plugins that put Claude *inside* Obsidian. This is the inverse, and it exists because:

- **Your assistant is Claude Desktop** — that's where the general-purpose conversations happen. Your notes become one of many contexts Claude can reach, alongside web, GitHub, filesystems, etc.
- **Security is a first-class concern** — deliberate attack surface, no shell access, path traversal blocked, inputs validated with Zod, every call audited.
- **Zero build, zero account** — `npx obsidian-mcp-secure` and done. Works on Windows, macOS, Linux the same way.
- **Composability** — combine this MCP with fetch, filesystem, git, GitHub, etc., and Claude can cross-reference your vault with external sources in a single conversation.

---

## 🛠️ Available Tools

| Tool | Purpose |
|------|---------|
| `read_note` | Read a note by path |
| `list_notes` | List files/folders in the vault or a subdirectory |
| `create_note` | Create a new `.md` note |
| `edit_note` | Overwrite an existing note (previous content goes to the audit log) |
| `delete_note` | Delete a note — **requires `confirm: true`** (Zod rejects otherwise) |
| `search_notes` | Full-text / tag search using Obsidian's own search engine |
| `find_note_by_name` | Find notes by partial name — case-insensitive, no exact path needed |
| `list_tags` | Enumerate all tags in the vault with usage count; sortable by name or frequency |
| `create_backlinks` | Add `[[wikilinks]]` to a `## Relacionadas` section in a note — explicit and auditable |

---

## 🔒 Security — OWASP Top 10

| Control | Implementation |
|---------|----------------|
| **A01** — Broken Access Control | Path traversal blocked (`../`, `..\\`, encoded variants); `.md` extension enforced |
| **A02** — Cryptographic Failures | API key read from `.env` or process env; never hardcoded, never logged |
| **A03** — Injection | All inputs validated with Zod schemas; no `eval`, no `exec`, no shell |
| **A04** — Insecure Design | 512 KB max note size; 50-result cap on search; destructive ops require explicit `confirm: true` |
| **A05** — Security Misconfiguration | Only `127.0.0.1` / `localhost` accepted as host |
| **A09** — Logging & Monitoring | Full audit log via winston with size-based rotation (5 MB / 10 files) |

Every tool call emits an audit line with `action`, `params` (sanitized), `success`, `error`, and `timestamp`.

---

## ⚡ Installation

### Prerequisites

1. [**Obsidian Desktop**](https://obsidian.md) with a vault open
2. The [**Local REST API plugin**](https://github.com/coddingtonbear/obsidian-local-rest-api) (by Adam Coddington) — install from Community Plugins, enable it, and:
   - Turn on **"Enable Non-encrypted (HTTP) Server"** (simpler than HTTPS self-signed certs)
   - Copy the **API Key** shown in the plugin settings
3. **Node.js 18+**
4. **Claude Desktop** (or another MCP-compatible client)

### Configure Claude Desktop

Open `%APPDATA%\Claude\claude_desktop_config.json` on Windows (or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS) and add:

```json
{
  "mcpServers": {
    "obsidian-secure": {
      "command": "npx",
      "args": ["-y", "obsidian-mcp-secure"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-from-the-plugin",
        "OBSIDIAN_HOST": "http://127.0.0.1",
        "OBSIDIAN_PORT": "27123",
        "LOG_DIR": "C:/path/to/your/logs"
      }
    }
  }
}
```

> **Windows tip:** if `npx` fails silently, switch `"command": "npx"` to `"command": "npx.cmd"`. Some Claude Desktop builds don't resolve bare `npx` on PATH.

Restart Claude Desktop (tray → **Quit**, then reopen) and the 9 tools will show up under `obsidian-secure`.

---

## 🤝 Recommended companions

The real power of MCPs is composability. To reproduce the *"read my note → fetch a URL → tell me if I'm applying it correctly"* workflow, add the official **fetch** MCP alongside this one:

```json
{
  "mcpServers": {
    "obsidian-secure": { "...": "as above" },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

Now Claude has both your vault and the live web in a single conversation.

---

## 💬 Example prompts

With `obsidian-secure` + `fetch` enabled:

> *"Read my note `Projeto API Atendimento.md`, then fetch https://developers.facebook.com/docs/whatsapp and tell me if my implementation matches the latest best practices."*

> *"Search my vault for the tag `#ideia` and summarize the three ideas that appear most often. Then create a new note called `Ideias recorrentes.md` with the summary."*

> *"Read `Atomic Habits - Resumo.md`, fetch https://jamesclear.com/atomic-habits, and point out where my notes drifted from the original."*

Claude will orchestrate the tool calls automatically — no manual chaining.

---

## 🧩 Comparison with in-Obsidian plugins

If your workflow lives inside Obsidian's sidebar, plugins like [`obsidian-claude-code`](https://github.com/Roasbeef/obsidian-claude-code) are the right fit. This MCP targets a different shape:

| Dimension | `obsidian-claude-code` (in-Obsidian) | `obsidian-mcp-secure` (this) |
|---|---|---|
| Where the AI lives | Sidebar inside Obsidian | Claude Desktop (or any MCP client) |
| Setup | `git clone` + `bun build` | `npx obsidian-mcp-secure` |
| Tools | Read/Write/Edit + Bash + Grep + Glob + WebFetch | 9 purpose-built, Zod-validated tools |
| Security posture | Full shell access to dev machine | Tight allowlist, audited, OWASP Top 10 |
| Distribution | Manual clone, requires Bun | npm + official MCP Registry |
| Composability with other sources | Inside its own sandbox | Any MCP-compatible client can mix it with fetch, GitHub, filesystem, etc. |
| Best for | Dev who lives in Obsidian | Professional whose main surface is Claude Desktop |

Both are valid — they occupy different niches.

---

## 🔧 Environment variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `OBSIDIAN_API_KEY` | ✅ | — | API key from the Local REST API plugin |
| `OBSIDIAN_HOST` | | `http://127.0.0.1` | Host (only `127.0.0.1` and `localhost` are accepted) |
| `OBSIDIAN_PORT` | | `27123` | Port of the plugin's HTTP server |
| `LOG_DIR` | | `./logs` | Directory for the audit log files |

---

## 🗺️ Roadmap

### ✅ Shipped in v1.2.1

- [x] Bug fix: `find_note_by_name` searches full path (folder + filename)
- [x] Bug fix: `list_tags` normalizes all API response formats (object, array of strings, array of objects with `tagCount`/`taggedFilesCount`)

### ✅ Shipped in v1.2.0

- [x] DXT package for one-click install in Claude Desktop (`npm run build:dxt`)

### ✅ Shipped in v1.1.0

- [x] `find_note_by_name` — partial, case-insensitive name match across the entire vault
- [x] `create_backlinks` — connect related notes with `[[wikilinks]]` (explicit, auditable)
- [x] `list_tags` — enumerate all tags in the vault with usage count
- [x] Unit test suite (70 tests — utils, handlers, HTTP client) with Vitest
- [x] CI pipeline on every PR: tests + coverage + `npm audit` + static security analysis

### 🔜 Up next

- [ ] Smithery listing
- [ ] Read-only mode flag for shared / multi-user setups

Ideas and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📜 License

MIT — see [LICENSE](LICENSE).

## 🙏 Credits

- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) by Adam Coddington — the foundation that makes this possible
- Built at [Dewtech](https://github.com/dewtech-technologies) by [Wanderson Leandro](https://github.com/wleandrooliveira)

---

**Security issues?** See [SECURITY.md](SECURITY.md) for disclosure instructions.
