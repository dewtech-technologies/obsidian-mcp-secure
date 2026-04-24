# Changelog

Todas as mudanças notáveis serão documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

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
