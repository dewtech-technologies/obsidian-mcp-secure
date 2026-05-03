/**
 * Sanitização de inputs — OWASP A01/A03/A04
 */

// Bloqueia path traversal: ../  ..\  %2e%2e  etc.
export function sanitizePath(input) {
  if (!input || typeof input !== "string") throw new Error("Caminho inválido");

  const decoded = decodeURIComponent(input);
  if (/(\.\.|\/\/|\\|%2e|%2f|%5c)/i.test(decoded)) {
    throw new Error("Path traversal detectado — operação bloqueada (A01)");
  }

  const safe = decoded.replace(/[^\w\s\-\.\/À-ɏ]/g, "");
  if (safe !== decoded) {
    throw new Error("Caracteres não permitidos no caminho");
  }

  return safe.trim();
}

// Limita tamanho do conteúdo (A04 — DoS)
export function sanitizeContent(content, maxBytes = 512 * 1024) {
  if (!content) return "";
  if (typeof content !== "string") throw new Error("Conteúdo deve ser string");
  if (Buffer.byteLength(content, "utf8") > maxBytes) {
    throw new Error(`Conteúdo excede limite de ${maxBytes / 1024}KB`);
  }
  return content;
}

// Sanitiza query — remove operadores de injeção e caracteres de controle
export function sanitizeQuery(query) {
  if (!query || typeof query !== "string") throw new Error("Query inválida");
  if (query.length > 500) throw new Error("Query muito longa (máx 500 chars)");
  return query.replace(/[\x00-\x1F\x7F]/g, "").trim();
}
