import { describe, it, expect } from "vitest";
import { sanitizePath, sanitizeContent, sanitizeQuery } from "../src/utils.js";

// ─── sanitizePath ─────────────────────────────────────────────────────────────
describe("sanitizePath", () => {
  it("aceita caminho simples", () => {
    expect(sanitizePath("Notas/Reuniao.md")).toBe("Notas/Reuniao.md");
  });

  it("aceita caminho na raiz", () => {
    expect(sanitizePath("Arquivo.md")).toBe("Arquivo.md");
  });

  it("aceita letras acentuadas (UTF-8)", () => {
    expect(sanitizePath("Projetos/Revisão.md")).toBe("Projetos/Revisão.md");
  });

  it("bloqueia path traversal com ..", () => {
    expect(() => sanitizePath("../etc/passwd")).toThrow("Path traversal");
  });

  it("bloqueia path traversal com %2e%2e", () => {
    expect(() => sanitizePath("%2e%2e/etc/passwd")).toThrow("Path traversal");
  });

  it("bloqueia barras duplas", () => {
    expect(() => sanitizePath("Notas//Arquivo.md")).toThrow("Path traversal");
  });

  it("bloqueia backslash", () => {
    expect(() => sanitizePath("Notas\\Arquivo.md")).toThrow("Path traversal");
  });

  it("rejeita entrada vazia", () => {
    expect(() => sanitizePath("")).toThrow("Caminho inválido");
  });

  it("rejeita entrada não-string", () => {
    expect(() => sanitizePath(null)).toThrow("Caminho inválido");
    expect(() => sanitizePath(42)).toThrow("Caminho inválido");
  });

  it("remove caracteres especiais não permitidos", () => {
    expect(() => sanitizePath("nota<script>.md")).toThrow("Caracteres não permitidos");
  });
});

// ─── sanitizeContent ──────────────────────────────────────────────────────────
describe("sanitizeContent", () => {
  it("retorna string vazia quando content é falsy", () => {
    expect(sanitizeContent("")).toBe("");
    expect(sanitizeContent(null)).toBe("");
    expect(sanitizeContent(undefined)).toBe("");
  });

  it("retorna o conteúdo sem alterações quando válido", () => {
    const md = "# Título\n\nParágrafo com **negrito**.";
    expect(sanitizeContent(md)).toBe(md);
  });

  it("lança erro se content não for string", () => {
    expect(() => sanitizeContent(123)).toThrow("Conteúdo deve ser string");
    expect(() => sanitizeContent({})).toThrow("Conteúdo deve ser string");
  });

  it("lança erro se content exceder o limite padrão (512KB)", () => {
    const big = "a".repeat(513 * 1024);
    expect(() => sanitizeContent(big)).toThrow("excede limite");
  });

  it("aceita conteúdo exatamente no limite", () => {
    const atLimit = "a".repeat(512 * 1024);
    expect(sanitizeContent(atLimit)).toBe(atLimit);
  });

  it("respeita maxBytes customizado", () => {
    expect(() => sanitizeContent("hello", 3)).toThrow("excede limite");
    expect(sanitizeContent("hi", 10)).toBe("hi");
  });
});

// ─── sanitizeQuery ────────────────────────────────────────────────────────────
describe("sanitizeQuery", () => {
  it("retorna query válida sem alterações", () => {
    expect(sanitizeQuery("reunião projeto")).toBe("reunião projeto");
  });

  it("aceita tags do Obsidian", () => {
    expect(sanitizeQuery("#projeto")).toBe("#projeto");
  });

  it("remove caracteres de controle", () => {
    expect(sanitizeQuery("texto\x00com\x1Fcontrole")).toBe("textocomcontrole");
  });

  it("rejeita query vazia", () => {
    expect(() => sanitizeQuery("")).toThrow("Query inválida");
    expect(() => sanitizeQuery(null)).toThrow("Query inválida");
  });

  it("rejeita query não-string", () => {
    expect(() => sanitizeQuery(42)).toThrow("Query inválida");
  });

  it("rejeita query maior que 500 caracteres", () => {
    expect(() => sanitizeQuery("a".repeat(501))).toThrow("muito longa");
  });

  it("aceita query com exatamente 500 caracteres", () => {
    const q = "a".repeat(500);
    expect(sanitizeQuery(q)).toBe(q);
  });

  it("faz trim do resultado", () => {
    expect(sanitizeQuery("  busca  ")).toBe("busca");
  });
});
