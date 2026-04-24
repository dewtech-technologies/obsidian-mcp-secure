# Contribuindo com o obsidian-mcp-secure

Obrigado pelo interesse! Este projeto aceita contribuições de qualquer pessoa. Siga as diretrizes abaixo.

## Como contribuir

### 1. Reportar bugs
Abra uma [Issue](../../issues/new?template=bug_report.md) descrevendo:
- O que você esperava que acontecesse
- O que aconteceu de fato
- Versão do Node.js, SO e Obsidian

### 2. Sugerir features
Abra uma [Issue](../../issues/new?template=feature_request.md) com o label `enhancement`.

### 3. Enviar código (Pull Request)

```bash
# 1. Fork o repositório no GitHub

# 2. Clone o seu fork
git clone https://github.com/SEU_USER/obsidian-mcp-secure.git
cd obsidian-mcp-secure

# 3. Crie uma branch descritiva
git checkout -b feat/nome-da-feature
# ou
git checkout -b fix/nome-do-bug

# 4. Instale as dependências
npm install

# 5. Faça suas alterações e commit
git commit -m "feat: descrição clara da mudança"

# 6. Push e abra o PR
git push origin feat/nome-da-feature
```

## Padrão de commits (Conventional Commits)

| Prefixo | Quando usar |
|---------|-------------|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `docs:` | Apenas documentação |
| `security:` | Correção de segurança |
| `refactor:` | Refatoração sem mudança de comportamento |
| `chore:` | Atualização de dependências, config |

## Diretrizes de segurança

- Qualquer PR que adicione nova ferramenta MCP **deve** incluir sanitização de input
- Nunca commitar API keys, tokens ou senhas — use `.env`
- Reporte vulnerabilidades **em privado** via email (veja SECURITY.md) antes de abrir Issue pública

## Code style

- JavaScript ES Modules (import/export)
- Sem dependências desnecessárias — mantenha o projeto leve
- Toda função nova deve ter comentário explicando o controle OWASP aplicado

## Dúvidas?

Abra uma [Discussion](../../discussions) no GitHub.
