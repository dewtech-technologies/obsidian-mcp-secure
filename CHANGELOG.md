# Changelog

Todas as mudanças notáveis serão documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [1.1.0] — 2026-05-03

### Adicionado
- Ferramenta `find_note_by_name` — busca parcial e insensível a maiúsculas pelo nome da nota, sem necessidade de conhecer o caminho exato
- Ferramenta `list_tags` — lista todas as tags do vault com contagem de ocorrências; ordenável por nome ou frequência
- Ferramenta `create_backlinks` — adiciona `[[wikilinks]]` em uma seção `## Relacionadas` na nota de origem (cria a seção se não existir)
- Suite de testes unitários com Vitest: 67 testes cobrindo utils, handlers e HTTP client
- Pipeline de CI no GitHub Actions (executa a cada PR): testes + cobertura + `npm audit` + análise estática de segurança

### Refatorado
- `src/server.js` separado em módulos independentes (`src/utils.js`, `src/client.js`, `src/handlers.js`) para facilitar testes e manutenção
- Handlers das tools agora usam injeção de dependência para o cliente HTTP, eliminando a necessidade de mocks globais nos testes

---

## [1.0.4] — 2026-04-24

### Corrigido (crítico)
- **`create_note` e `edit_note`** agora enviam o conteúdo da nota como body **raw** com `Content-Type: text/markdown`, como o plugin Local REST API espera. Antes o markdown era serializado como JSON `{"content": "..."}` e o plugin salvava a string escapada literalmente no arquivo — notas ficavam ilegíveis com `\n` literais e envolvidas em `{"content":"..."}`.
- **`read_note`** tolera ambas formas de resposta do plugin (texto raw ou JSON `{content: "..."}`), extraindo o conteúdo corretamente em qualquer caso.
- **`obsidianRequest`** agora detecta automaticamente se o body é string (envia como `text/markdown`) ou objeto (serializa como `application/json`).

## [1.0.3] — 2026-04-24

### Corrigido
- `search_notes` agora envia `query` e `contextLength` via query string, como o plugin Local REST API do Obsidian exige no endpoint `POST /search/simple/`. Antes estavam indo no body JSON, resultando em `400 Bad Request` ("A single '?query=' parameter is required").

## [1.0.2] — 2026-04-24

### Corrigido
- **Crítico:** removidos 3 bytes espúrios (`-e ` literal) no início de `src/server.js` que vieram de um `echo -e` mal escapado durante a criação do arquivo. Isso fazia o Node interpretar a primeira linha como código JavaScript em vez de shebang, quebrando a execução via `npx`/`node` — clientes MCP recebiam "Server disconnected" imediatamente após o handshake `initialize`.

## [1.0.1] — 2026-04-24

### Adicionado
- Campo `mcpName` no `package.json` exigido pelo MCP Registry oficial da Anthropic para vincular o pacote npm ao namespace `io.github.dewtech-technologies/obsidian-mcp-secure`

## [1.0.0] — 2026-04-19

### Adicionado
- Ferramenta `read_note` — leitura de notas por caminho
- Ferramenta `list_notes` — listagem de arquivos do vault
- Ferramenta `create_note` — criação de notas .md
- Ferramenta `edit_note` — edição com backup no log de auditoria
- Ferramenta `delete_note` — deleção com confirmação explícita obrigatória
- Ferramenta `search_notes` — busca por conteúdo e tags
- Audit log completo com rotação automática (winston)
- Bloqueio de path traversal (OWASP A01)
- API key exclusivamente via variável de ambiente (OWASP A02)
- Sanitização de todos os inputs (OWASP A03)
- Limite de tamanho de payload 512KB (OWASP A04)
- Restrição de host para localhost apenas (OWASP A05)
