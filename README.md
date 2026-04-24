# obsidian-mcp-secure

> Servidor MCP seguro para conectar Claude Desktop ao Obsidian — baseado no OWASP Top 10

[![npm version](https://img.shields.io/npm/v/obsidian-mcp-secure)](https://www.npmjs.com/package/obsidian-mcp-secure)
[![license](https://img.shields.io/npm/l/obsidian-mcp-secure)](LICENSE)
[![npm audit](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)](package.json)

## Por que este projeto?

Os servidores MCP existentes para Obsidian não implementam controles de segurança adequados. Este projeto foi criado do zero com foco em segurança, auditabilidade e sem dependências desnecessárias.

## Funcionalidades

| Ferramenta | Descrição |
|------------|-----------|
| `read_note` | Lê uma nota pelo caminho |
| `list_notes` | Lista arquivos e pastas do vault |
| `create_note` | Cria uma nova nota (.md) |
| `edit_note` | Edita nota existente (conteúdo anterior salvo no log) |
| `delete_note` | Deleta nota (exige `confirm: true`) |
| `search_notes` | Busca por conteúdo ou tag |

## Segurança (OWASP Top 10)

| Controle | Implementação |
|----------|--------------|
| A01 — Broken Access Control | Bloqueio de path traversal, extensão `.md` obrigatória |
| A02 — Cryptographic Failures | API key exclusivamente via `.env`, nunca no código |
| A03 — Injection | Sanitização de todos os inputs, sem `eval`/`exec` |
| A04 — Insecure Design | Limite de 512KB por nota, máx 50 resultados na busca |
| A05 — Security Misconfiguration | Apenas `localhost` permitido como host |
| A09 — Logging & Monitoring | Audit log completo com rotação automática |

## Pré-requisitos

- Node.js 18+
- Obsidian Desktop com plugin **Local REST API** instalado
- Claude Desktop

## Instalação via npx (recomendado)

Configure `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian-secure": {
      "command": "npx",
      "args": ["-y", "obsidian-mcp-secure"],
      "env": {
        "OBSIDIAN_API_KEY": "sua_api_key_aqui",
        "OBSIDIAN_HOST": "http://127.0.0.1",
        "OBSIDIAN_PORT": "27123"
      }
    }
  }
}
```

Reinicie o Claude Desktop. O ícone 🔨 indica que o MCP está ativo.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Segurança

Veja [SECURITY.md](SECURITY.md) para reportar vulnerabilidades de forma responsável.

## Licença

MIT
