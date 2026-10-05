# Contributing · Contribuindo

Thanks for your interest. This is a small personal project; contributions that keep it small are the ones most likely to be merged.

*Em português logo abaixo.*

## Before you start

- **Open an issue first** for anything bigger than a bug fix, so we can agree on the approach before you spend time on it.
- **The project language is Portuguese**: code identifiers, comments, interface text and API names. Please keep new code consistent with that. Issues and pull requests can be written in English or Portuguese.
- **Read [AGENTS.md](AGENTS.md).** It is written for AI agents, but the rules apply to everyone: business rules live in `server/src/nucleo.ts`, every write records an author, no new dependencies without a good reason, strict TypeScript.

## Setup

```bash
cd server && npm install && npm run dev    # API + MCP on 127.0.0.1:8078
cd web    && npm install && npm run dev    # interface on localhost:5174
```

By default the server stores its database in `~/.agent-board/board.db`. To keep development data apart from a board you actually use, set `BOARD_DB=/tmp/board-dev.db`.

## Before opening a pull request

```bash
cd server && npm run typecheck && npm test && npm run build && node verificar-integracao.mjs
cd web    && npm run lint && npm run build
```

All of them must pass; CI runs the same checks on Node 20 and 22.

- If you changed `nucleo.ts`, add a test in `nucleo.test.ts`. It is pure logic over SQLite and runs in memory.
- Database changes must be additive (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN` with a default). Existing boards must keep working without a manual migration.
- Existing REST routes and MCP tool names must keep their behaviour. Add fields and routes; do not rename or remove.
- For interface changes, attach a screenshot in each theme you touched.

## Reporting a security problem

Do not open a public issue. See [SECURITY.md](SECURITY.md).

---

# Contribuindo

Obrigado pelo interesse. Este é um projeto pessoal e pequeno; as contribuições que o mantêm pequeno são as que têm mais chance de entrar.

## Antes de começar

- **Abra uma issue antes** de qualquer coisa maior que uma correção, para combinarmos o caminho antes de você gastar tempo.
- **O idioma do projeto é o português**: identificadores, comentários, textos da interface e nomes da API. Issues e pull requests podem ser em português ou inglês.
- **Leia o [AGENTS.md](AGENTS.md).** Foi escrito para agentes de IA, mas as regras valem para todos: regra de negócio fica em `server/src/nucleo.ts`, toda escrita registra autor, nada de dependência nova sem bom motivo, TypeScript estrito.

## Antes de abrir um pull request

Rode os comandos da seção em inglês acima; todos precisam passar. Além disso:

- Mexeu no `nucleo.ts`? Escreva teste em `nucleo.test.ts`.
- Mudança de banco tem que ser aditiva. Um quadro existente precisa continuar funcionando sem migração manual.
- Rotas REST e ferramentas MCP existentes mantêm o comportamento. Acrescente; não renomeie nem remova.
- Em mudança de interface, anexe captura de tela em cada tema que você tocou.

## Problema de segurança

Não abra issue pública. Veja o [SECURITY.md](SECURITY.md).
