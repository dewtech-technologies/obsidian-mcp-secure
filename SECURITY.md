# Política de Segurança

## Versões suportadas

| Versão | Suportada |
|--------|-----------|
| 1.x    | ✅ |

## Reportando uma vulnerabilidade

**NÃO abra uma Issue pública para vulnerabilidades de segurança.**

Envie um email para o mantenedor com:
- Descrição da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestão de correção (opcional)

Você receberá uma resposta em até **72 horas**.

Se confirmada, a vulnerabilidade será corrigida e creditada no CHANGELOG antes da divulgação pública.

## Escopo

Está dentro do escopo:
- Path traversal no acesso ao vault
- Bypass de sanitização de inputs
- Exposição de API key nos logs
- Execução de código arbitrário

Está fora do escopo:
- Ataques que requerem acesso físico à máquina
- Bugs no próprio Obsidian ou Claude Desktop
