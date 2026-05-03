import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Importamos após configurar o fetch mock para evitar efeitos colaterais do import
let obsidianRequest;

beforeEach(async () => {
  // Reseta o módulo para isolar cada teste do CONFIG
  vi.resetModules();
  process.env.OBSIDIAN_API_KEY = "sk-test-key";
  process.env.OBSIDIAN_HOST    = "http://127.0.0.1";
  process.env.OBSIDIAN_PORT    = "27123";
  ({ obsidianRequest } = await import("../src/client.js"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status, body, contentType = "application/json") {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    json: () => Promise.resolve(typeof body === "string" ? JSON.parse(body) : body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

// ─── URL e host ───────────────────────────────────────────────────────────────
describe("obsidianRequest — validação de host", () => {
  it("lança erro se host não for localhost", async () => {
    process.env.OBSIDIAN_HOST = "http://evil.com";
    vi.resetModules();
    const { obsidianRequest: req } = await import("../src/client.js");
    mockFetch(200, {});
    await expect(req("GET", "/vault/")).rejects.toThrow("Host não permitido");
  });

  it("aceita 127.0.0.1 como host", async () => {
    mockFetch(200, { files: [] });
    await expect(obsidianRequest("GET", "/vault/")).resolves.toBeDefined();
  });
});

// ─── Método GET ───────────────────────────────────────────────────────────────
describe("obsidianRequest — GET", () => {
  it("envia Authorization header com Bearer token", async () => {
    const fetchMock = mockFetch(200, { files: [] });
    await obsidianRequest("GET", "/vault/");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Authorization"]).toBe("Bearer sk-test-key");
  });

  it("retorna JSON quando Content-Type é application/json", async () => {
    mockFetch(200, { files: ["Nota.md"] }, "application/json");
    const result = await obsidianRequest("GET", "/vault/");
    expect(result).toEqual({ files: ["Nota.md"] });
  });

  it("retorna texto quando Content-Type não é JSON", async () => {
    mockFetch(200, "# Conteúdo", "text/markdown");
    const result = await obsidianRequest("GET", "/vault/Nota.md");
    expect(result).toBe("# Conteúdo");
  });
});

// ─── Método PUT (string raw) ──────────────────────────────────────────────────
describe("obsidianRequest — PUT com string", () => {
  it("envia Content-Type text/markdown para body string", async () => {
    const fetchMock = mockFetch(200, "", "text/markdown");
    await obsidianRequest("PUT", "/vault/Nota.md", "# Conteúdo");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("text/markdown");
    expect(options.body).toBe("# Conteúdo");
  });
});

// ─── Método PUT (objeto JSON) ─────────────────────────────────────────────────
describe("obsidianRequest — PUT com objeto", () => {
  it("envia Content-Type application/json para body objeto", async () => {
    const fetchMock = mockFetch(200, {}, "application/json");
    await obsidianRequest("PUT", "/vault/Nota.md", { key: "value" });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.body).toBe(JSON.stringify({ key: "value" }));
  });
});

// ─── Tratamento de erros HTTP ─────────────────────────────────────────────────
describe("obsidianRequest — erros HTTP", () => {
  it("lança erro com status quando resposta não for ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => "text/plain" },
      text: () => Promise.resolve("not found"),
    }));
    await expect(obsidianRequest("GET", "/vault/nao-existe.md"))
      .rejects.toThrow("Obsidian API erro 404");
  });

  it("lança erro com status 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => "text/plain" },
      text: () => Promise.resolve("internal server error"),
    }));
    await expect(obsidianRequest("GET", "/vault/"))
      .rejects.toThrow("Obsidian API erro 500");
  });
});

// ─── sanitizeForLog ───────────────────────────────────────────────────────────
describe("sanitizeForLog", () => {
  it("redacta API keys do formato sk-...", async () => {
    const { sanitizeForLog } = await import("../src/client.js");
    const result = sanitizeForLog({ key: "sk-abc123-xyz" });
    expect(JSON.stringify(result)).toContain("[REDACTED]");
    expect(JSON.stringify(result)).not.toContain("sk-abc123");
  });

  it("não altera objetos sem API key", async () => {
    const { sanitizeForLog } = await import("../src/client.js");
    const obj = { path: "Nota.md", size: 42 };
    expect(sanitizeForLog(obj)).toEqual(obj);
  });
});
