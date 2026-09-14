# agent-board

Um quadro Kanban que agentes de IA operam via **MCP**.

O problema: quando várias sessões de IA trabalham nos mesmos projetos, cada uma começa do zero. Nenhuma sabe o que a outra fez, o que está em andamento, ou por que aquela decisão foi tomada.

Este quadro é o estado compartilhado. Você arrasta cards pela interface; as sessões leem e escrevem pelas mesmas operações, via MCP. **Toda mudança fica registrada com autor** — abrir um card mostra quem criou, quem moveu e o que cada sessão comentou.

## Como funciona

```
  interface web  ──┐
                   ├──►  API + SQLite
  Claude / Codex ──┘        ▲
  (via MCP)                 │
                     histórico com autoria
```

API REST e ferramentas MCP compartilham o mesmo núcleo (`server/src/nucleo.ts`), então não há como uma via divergir da outra.

## Ferramentas MCP

| Ferramenta | Para quê |
|---|---|
| `ver_quadro` | Estado atual — colunas e cards |
| `ver_card` | Um card com todo o histórico |
| `criar_card` | Novo card (coluna pelo nome, ex.: "A fazer") |
| `mover_card` | Reportar progresso movendo de coluna |
| `atualizar_card` | Editar título, descrição, projeto |
| `comentar_card` | Registrar decisão ou bloqueio para a próxima sessão |
| `remover_card` | Apagar (marcada como destrutiva) |
| `atividade_recente` | O que mudou desde a última vez |

Toda ferramenta de escrita exige `autor`. Sem isso o quadro vira um estado sem história — e a história é o ponto.

## Rodando

> **Nota:** O servidor usa `better-sqlite3`, que compila código nativo durante a instalação. Dependendo do seu sistema, isso pode exigir ferramentas de build (`build-essential`/`python3` no Linux, Xcode CLI tools no macOS, VS Build Tools no Windows). O caminho mais fácil para evitar isso é rodar via **Docker Compose**: `docker compose up --build`.

**Servidor** (API em `/api`, MCP em `/mcp`):

```bash
cd server && npm install && npm run dev
```

**Interface:**

```bash
cd web && npm install && npm run dev
```

A interface sobe em `http://localhost:5174` e conversa com a API por proxy.

### Variáveis

| Variável | Padrão | O que faz |
|---|---|---|
| `BOARD_DB` | `~/.agent-board/board.db` | Arquivo SQLite |
| `BOARD_PORT` | `8078` | Porta |
| `BOARD_HOST` | `127.0.0.1` | Interface de rede |
| `BOARD_API_KEY` | *(vazio)* | Exige `Authorization: Bearer` quando definida |

⚠️ Sem `BOARD_API_KEY` o servidor sobe **sem autenticação**. Aceitável em `127.0.0.1`; se mudar o `BOARD_HOST`, defina a chave.

## Conectando uma IA

```bash
# Claude Code
claude mcp add --scope user --transport http agent-board http://SEU_HOST:8078/mcp \
  --header "Authorization: Bearer SUA_CHAVE"

# Codex
codex mcp add agent-board --url http://SEU_HOST:8078/mcp \
  --bearer-token-env-var BOARD_API_KEY
```

## Decisões técnicas

- **SQLite** em vez de Postgres. O gargalo é o tempo do agente, não o banco. Arquivo único, backup por `cp`, zero serviço para manter.
- **MCP stateless** — cada requisição cria seu transporte. Sem sessão para expirar; o custo é não ter notificações do servidor, que este quadro não usa.
- **Posições em float** com espaçamento de 1000. Reordenar é calcular a média entre vizinhos, sem reescrever a coluna inteira.
- **Drag and drop nativo** do HTML5, sem biblioteca. Menos 30 kB e uma dependência a menos para manter.
- **Atualização otimista** no arraste: o card move na tela antes da resposta do servidor, senão a interação parece travada.
- **Poll de 4s com comparação de assinatura** — só re-renderiza quando algo realmente mudou, senão o quadro pisca sozinho.

## Limitações conhecidas

- Poll, não WebSocket. Mudança de outra sessão aparece em até 4 segundos.
- Um quadro só na interface (o modelo suporta vários).
- Sem autenticação de usuário — o `autor` é declarado, não verificado. Serve para uso pessoal, não para equipe com controle de acesso.

## Licença

[MIT](LICENSE)
