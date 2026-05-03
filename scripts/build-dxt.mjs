/**
 * Build script para gerar o pacote DXT do obsidian-mcp-secure.
 *
 * Cria um diretório temporário com arquivos de produção,
 * instala apenas as dependências de produção e chama mcpb pack.
 */

import { execSync }                                          from "child_process";
import { cpSync, mkdirSync, rmSync, existsSync,
         readFileSync, writeFileSync, statSync }             from "fs";
import { join, resolve, dirname }                            from "path";
import { fileURLToPath }                                     from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "..");
const dist      = join(root, ".dxt-build");
const output    = join(root, "obsidian-mcp-secure.dxt");
const mcpb      = join(root, "node_modules", ".bin", "mcpb");

// ── Limpa build anterior ─────────────────────────────────────────────────────
if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

// ── Copia arquivos de produção ───────────────────────────────────────────────
console.log("📂  Copiando arquivos de produção...");
cpSync(join(root, "src"),          join(dist, "src"),          { recursive: true });
cpSync(join(root, "manifest.json"), join(dist, "manifest.json"));
cpSync(join(root, ".env.example"),  join(dist, ".env.example"));
cpSync(join(root, "README.md"),     join(dist, "README.md"));
cpSync(join(root, "LICENSE"),       join(dist, "LICENSE"));

// Copia package.json apenas com dependências de produção
const pkgRaw  = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const pkgProd = {
  name:         pkgRaw.name,
  version:      pkgRaw.version,
  type:         pkgRaw.type,
  dependencies: pkgRaw.dependencies,
  engines:      pkgRaw.engines,
};
writeFileSync(join(dist, "package.json"), JSON.stringify(pkgProd, null, 2));

// ── Instala apenas deps de produção ─────────────────────────────────────────
console.log("📦  Instalando dependências de produção...");
execSync("npm install --omit=dev --ignore-scripts", { cwd: dist, stdio: "inherit" });

// ── Valida manifest ──────────────────────────────────────────────────────────
console.log("✅  Validando manifest...");
execSync(`"${mcpb}" validate manifest.json`, { cwd: dist, stdio: "inherit" });

// ── Empacota DXT ─────────────────────────────────────────────────────────────
console.log("🗜   Empacotando DXT...");
execSync(`"${mcpb}" pack . "${output}"`, { cwd: dist, stdio: "inherit" });

// ── Limpeza ───────────────────────────────────────────────────────────────────
rmSync(dist, { recursive: true, force: true });

const sizeKB = (statSync(output).size / 1024).toFixed(1);
console.log(`\n✨  obsidian-mcp-secure.dxt gerado — ${sizeKB} KB`);
