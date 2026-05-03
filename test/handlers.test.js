import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeHandlers } from "../src/handlers.js";

// Fábrica de mocks reutilizável
function setup() {
  const request = vi.fn();
  const audit   = vi.fn();
  const h       = makeHandlers(request, audit);
  return { request, audit, h };
}

// ─── read_note ────────────────────────────────────────────────────────────────
describe("read_note", () => {
  it("retorna conteúdo de nota (string raw)", async () => {
    const { request, h } = setup();
    request.mockResolvedValue("# Conteúdo da Nota");
    const res = await h.read_note({ path: "Projetos/Nota.md" });
    expect(res.content[0].text).toBe("# Conteúdo da Nota");
    expect(res.isError).toBeUndefined();
  });

  it("retorna conteúdo quando API retorna objeto {content}", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ content: "## Título" });
    const res = await h.read_note({ path: "Nota.md" });
    expect(res.content[0].text).toBe("## Título");
  });

  it("retorna erro em caso de path traversal", async () => {
    const { h } = setup();
    const res = await h.read_note({ path: "../etc/passwd" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Path traversal/);
  });

  it("retorna erro quando API falha", async () => {
    const { request, h } = setup();
    request.mockRejectedValue(new Error("Obsidian API erro 404: not found"));
    const res = await h.read_note({ path: "Inexistente.md" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/404/);
  });
});

// ─── list_notes ───────────────────────────────────────────────────────────────
describe("list_notes", () => {
  it("lista raiz do vault quando directory está vazio", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ files: ["Nota1.md", "Pasta/Nota2.md"] });
    const res = await h.list_notes({ directory: "" });
    expect(request).toHaveBeenCalledWith("GET", "/vault/");
    expect(res.content[0].text).toContain("Nota1.md");
  });

  it("lista diretório específico", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ files: ["Projetos/A.md"] });
    const res = await h.list_notes({ directory: "Projetos" });
    expect(request).toHaveBeenCalledWith("GET", "/vault/Projetos/");
    expect(res.isError).toBeUndefined();
  });

  it("retorna erro quando API falha", async () => {
    const { request, h } = setup();
    request.mockRejectedValue(new Error("Obsidian API erro 500"));
    const res = await h.list_notes({});
    expect(res.isError).toBe(true);
  });
});

// ─── create_note ─────────────────────────────────────────────────────────────
describe("create_note", () => {
  it("cria nota com PUT correto", async () => {
    const { request, h } = setup();
    request.mockResolvedValue("");
    const res = await h.create_note({ path: "Projetos/Nova.md", content: "# Nova" });
    expect(request).toHaveBeenCalledWith("PUT", expect.stringContaining("Nova.md"), "# Nova");
    expect(res.content[0].text).toContain("criada");
  });

  it("rejeita extensão não .md", async () => {
    const { h } = setup();
    const res = await h.create_note({ path: "script.js", content: "code" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/extensão .md/);
  });

  it("rejeita path traversal", async () => {
    const { h } = setup();
    const res = await h.create_note({ path: "../../etc/cron.md", content: "evil" });
    expect(res.isError).toBe(true);
  });
});

// ─── edit_note ────────────────────────────────────────────────────────────────
describe("edit_note", () => {
  it("lê conteúdo anterior e escreve novo", async () => {
    const { request, h } = setup();
    request
      .mockResolvedValueOnce("# Conteúdo Anterior") // GET (backup)
      .mockResolvedValueOnce("");                    // PUT
    const res = await h.edit_note({ path: "Nota.md", content: "# Novo" });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith("PUT", expect.any(String), "# Novo");
    expect(res.content[0].text).toContain("editada");
  });

  it("continua mesmo se leitura do backup falhar", async () => {
    const { request, h } = setup();
    request
      .mockRejectedValueOnce(new Error("404")) // GET falha
      .mockResolvedValueOnce("");              // PUT ok
    const res = await h.edit_note({ path: "Nota.md", content: "# Novo" });
    expect(res.isError).toBeUndefined();
  });
});

// ─── delete_note ─────────────────────────────────────────────────────────────
describe("delete_note", () => {
  it("deleta nota e loga conteúdo anterior", async () => {
    const { request, audit, h } = setup();
    request
      .mockResolvedValueOnce("# Conteúdo") // GET backup
      .mockResolvedValueOnce("");           // DELETE
    const res = await h.delete_note({ path: "Nota.md", confirm: true });
    expect(request).toHaveBeenLastCalledWith("DELETE", expect.stringContaining("Nota.md"));
    expect(audit).toHaveBeenCalledWith("delete_note", expect.any(Object), "ok");
    expect(res.content[0].text).toContain("deletada");
  });

  it("rejeita extensão não .md", async () => {
    const { h } = setup();
    const res = await h.delete_note({ path: "arquivo.txt", confirm: true });
    expect(res.isError).toBe(true);
  });
});

// ─── search_notes ─────────────────────────────────────────────────────────────
describe("search_notes", () => {
  it("retorna resultados do vault", async () => {
    const { request, h } = setup();
    const fakeResults = [{ filename: "Nota.md", score: 1, matches: [] }];
    request.mockResolvedValue(fakeResults);
    const res = await h.search_notes({ query: "reunião", limit: 10 });
    expect(res.content[0].text).toContain("Nota.md");
  });

  it("trunca ao limite informado", async () => {
    const { request, h } = setup();
    request.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ filename: `N${i}.md` })));
    const res = await h.search_notes({ query: "teste", limit: 5 });
    const results = JSON.parse(res.content[0].text);
    expect(results).toHaveLength(5);
  });

  it("rejeita query inválida", async () => {
    const { h } = setup();
    const res = await h.search_notes({ query: "", limit: 10 });
    expect(res.isError).toBe(true);
  });
});

// ─── find_note_by_name ────────────────────────────────────────────────────────
describe("find_note_by_name", () => {
  const files = [
    "Projetos/reuniao-sprint.md",
    "Projetos/Planejamento.md",
    "Arquivo/reuniao-mensal.md",
    "Ideias.md",
  ];

  it("encontra notas por substring do nome (case-insensitive)", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ files });
    const res = await h.find_note_by_name({ name: "Reuniao", limit: 20 });
    const lines = res.content[0].text.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("reuniao-sprint");
    expect(lines[1]).toContain("reuniao-mensal");
  });

  it("retorna mensagem quando não encontrar nada", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ files });
    const res = await h.find_note_by_name({ name: "xyz-inexistente", limit: 20 });
    expect(res.content[0].text).toContain("Nenhuma nota");
  });

  it("respeita o limite", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ files: Array.from({ length: 20 }, (_, i) => `Pasta/nota${i}.md`) });
    const res = await h.find_note_by_name({ name: "nota", limit: 3 });
    expect(res.content[0].text.split("\n")).toHaveLength(3);
  });

  it("filtra apenas pelo basename, não pelo path completo", async () => {
    const { request, h } = setup();
    // "Projetos" está no path mas não no basename
    request.mockResolvedValue({ files: ["Projetos/Ideias.md"] });
    const res = await h.find_note_by_name({ name: "Projetos", limit: 20 });
    expect(res.content[0].text).toContain("Nenhuma nota");
  });
});

// ─── list_tags ────────────────────────────────────────────────────────────────
describe("list_tags", () => {
  it("lista tags ordenadas por nome (padrão)", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ "#projetos": 5, "#arquivo": 2, "#reuniao": 8 });
    const res = await h.list_tags({ sort: "name" });
    const lines = res.content[0].text.split("\n");
    expect(lines[0]).toContain("#arquivo");
    expect(lines[1]).toContain("#projetos");
    expect(lines[2]).toContain("#reuniao");
  });

  it("lista tags ordenadas por contagem", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ "#projetos": 5, "#arquivo": 2, "#reuniao": 8 });
    const res = await h.list_tags({ sort: "count" });
    const lines = res.content[0].text.split("\n");
    expect(lines[0]).toContain("#reuniao (8)");
    expect(lines[1]).toContain("#projetos (5)");
  });

  it("exibe contagem ao lado da tag", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({ "#ideia": 3 });
    const res = await h.list_tags({ sort: "name" });
    expect(res.content[0].text).toBe("#ideia (3)");
  });

  it("retorna mensagem quando vault não tem tags", async () => {
    const { request, h } = setup();
    request.mockResolvedValue({});
    const res = await h.list_tags({ sort: "name" });
    expect(res.content[0].text).toContain("Nenhuma tag");
  });

  it("retorna erro quando API falha", async () => {
    const { request, h } = setup();
    request.mockRejectedValue(new Error("404"));
    const res = await h.list_tags({ sort: "name" });
    expect(res.isError).toBe(true);
  });
});

// ─── create_backlinks ─────────────────────────────────────────────────────────
describe("create_backlinks", () => {
  it("cria seção '## Relacionadas' quando não existe", async () => {
    const { request, h } = setup();
    request
      .mockResolvedValueOnce("# Minha Nota\n\nConteúdo aqui.") // GET source
      .mockResolvedValueOnce("");                               // PUT updated

    const res = await h.create_backlinks({
      source_path: "Notas/Fonte.md",
      target_paths: ["Conceitos/API.md", "Reunioes/2026-01.md"],
    });

    const [, , putBody] = request.mock.calls[1];
    expect(putBody).toContain("## Relacionadas");
    expect(putBody).toContain("[[API]]");
    expect(putBody).toContain("[[2026-01]]");
    expect(res.content[0].text).toContain("Backlinks adicionados");
  });

  it("appende à seção '## Relacionadas' existente", async () => {
    const { request, h } = setup();
    const existing = "# Nota\n\n## Relacionadas\n- [[Anterior]]\n";
    request.mockResolvedValueOnce(existing).mockResolvedValueOnce("");

    await h.create_backlinks({
      source_path: "Fonte.md",
      target_paths: ["Novo.md"],
    });

    const [, , putBody] = request.mock.calls[1];
    expect(putBody).toContain("[[Anterior]]");
    expect(putBody).toContain("[[Novo]]");
  });

  it("rejeita target_paths vazio", async () => {
    const { h } = setup();
    const res = await h.create_backlinks({ source_path: "Fonte.md", target_paths: [] });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/array não-vazio/);
  });

  it("rejeita source_path sem extensão .md", async () => {
    const { h } = setup();
    const res = await h.create_backlinks({
      source_path: "Fonte.txt",
      target_paths: ["Alvo.md"],
    });
    expect(res.isError).toBe(true);
  });

  it("rejeita target_path sem extensão .md", async () => {
    const { h } = setup();
    const res = await h.create_backlinks({
      source_path: "Fonte.md",
      target_paths: ["Alvo.txt"],
    });
    expect(res.isError).toBe(true);
  });

  it("rejeita path traversal no source", async () => {
    const { h } = setup();
    const res = await h.create_backlinks({
      source_path: "../../etc/passwd.md",
      target_paths: ["Alvo.md"],
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Path traversal/);
  });
});
