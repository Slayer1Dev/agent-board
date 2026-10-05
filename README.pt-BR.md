# agent-board

[English](README.md) · **Português**

Um quadro Kanban que agentes de IA operam via **MCP**, com interface web para o humano.

Quando várias sessões de IA trabalham nos mesmos projetos, cada uma começa do zero. Nenhuma sabe o que a outra fez, o que está em andamento ou por que uma decisão foi tomada. Este quadro é o estado compartilhado: você arrasta cards no navegador, e Claude Code, Codex e outros agentes leem e escrevem os mesmos cards por MCP, por uma API REST ou por uma pequena ferramenta de linha de comando. **Toda mudança fica registrada com autor**: abrir um card mostra qual sessão fez o quê.

![O quadro com cards de vários agentes](docs/screenshot.jpg)

## O que ele faz

- **Kanban com autoria.** Colunas, arrastar e soltar, comentários e um histórico por card que diz quem fez cada coisa.
- **Feito para agentes.** Mais de 30 ferramentas MCP por HTTP, uma API REST e uma CLI sem dependências. Os três usam o mesmo núcleo, então não têm como divergir.
- **Achar as coisas.** Busca em títulos, descrições, comentários e tags (Ctrl+K), filtros combináveis guardados na URL, tags e lista de projetos com contagens.
- **Vários quadros**, cada um com as suas colunas.
- **Lembretes e tarefas repetidas.** O agente pode pedir "lembretes de hoje" ao começar a sessão.
- **Seguro de operar.** Arquivar em vez de apagar, desfazer (Ctrl+Z) e controle de revisão para duas sessões não se sobrescreverem.
- **Três temas** (escuro, claro e vidro) e wallpapers guardados no servidor.
- **Pequeno.** SQLite em um arquivo, sem serviços externos, poucas dependências.

## Começando

Precisa de Node.js 20 ou mais novo. O `better-sqlite3` compila código nativo na instalação; no Linux pode ser preciso `build-essential` e `python3`.

```bash
git clone https://github.com/Slayer1Dev/agent-board.git
cd agent-board

# Terminal 1: API e MCP em http://127.0.0.1:8078
cd server && npm install && npm run dev

# Terminal 2: interface em http://localhost:5174
cd web && npm install && npm run dev
```

Ou com Docker (publica as duas portas só em localhost):

```bash
docker compose up --build
```

## Conectando um agente

**MCP** (exemplo com Claude Code; qualquer cliente MCP por HTTP serve):

```bash
claude mcp add --scope user --transport http agent-board http://127.0.0.1:8078/mcp
# com chave:  --header "Authorization: Bearer SUA_CHAVE"
```

**CLI**, para agentes sem MCP ou para o seu próprio terminal:

```bash
export AGENT_BOARD_URL=http://127.0.0.1:8078/api
export AGENT_BOARD_AUTHOR=claude

node cli/agent-board.mjs ver
node cli/agent-board.mjs criar "Corrigir o redirecionamento do login" --projeto site --coluna "A fazer"
node cli/agent-board.mjs mover 1a2b3c4d "Em andamento"
node cli/agent-board.mjs comentar 1a2b3c4d "A causa era o domínio do cookie."
node cli/agent-board.mjs buscar "cookie"
```

Há um arquivo de instruções pronto para o Claude Code em [integrations/claude-code-skill](integrations/claude-code-skill/SKILL.md). Peça a cada agente que se identifique: o campo `autor` é obrigatório em toda escrita.

A lista completa de rotas e ferramentas, com um exemplo de cada, está em [docs/API.md](docs/API.md).

## Configuração

| Variável | Padrão | Para quê |
|---|---|---|
| `BOARD_DB` | `~/.agent-board/board.db` | Arquivo SQLite |
| `BOARD_DADOS` | pasta do `BOARD_DB` | Onde ficam os wallpapers enviados |
| `BOARD_PORT` | `8078` | Porta |
| `BOARD_HOST` | `127.0.0.1` | Interface de rede em que o servidor escuta |
| `BOARD_API_KEY` | *(vazio)* | Quando definida, toda requisição precisa de `Authorization: Bearer <chave>` |
| `BOARD_HOSTS` | *(vazio)* | Nomes de host extras aceitos quando não há chave (separados por vírgula) |
| `BOARD_CORS_ORIGENS` | *(vazio)* | Origens de navegador autorizadas a chamar a API de outro endereço |
| `BOARD_PERMITIR_ABERTO` | *(vazio)* | `1` deixa o servidor escutar fora de localhost sem chave |
| `BOARD_FUSO` | `America/Sao_Paulo` | Fuso usado para decidir se um lembrete é "de hoje" |

## Modelo de segurança

É uma ferramenta pessoal, e os padrões assumem uma máquina só.

- **Sem chave, o servidor só aceita chamadas feitas ao seu próprio endereço em localhost.** Ele recusa cabeçalhos `Host` desconhecidos e requisições vindas de outros sites, então uma página aberta no seu navegador não consegue ler nem alterar o seu quadro.
- **Para acessar de outras máquinas, defina `BOARD_API_KEY`.** O servidor se recusa a subir numa interface que não seja local sem chave, a não ser que você defina `BOARD_PERMITIR_ABERTO=1` porque a porta já está protegida de outro jeito (VPN, firewall).
- **Não ponha a chave no build da interface.** Sirva a interface por um proxy que acrescenta o cabeçalho: o [web/vite.proxy.example.mjs](web/vite.proxy.example.mjs) faz exatamente isso.
- **`autor` é declarado, não verificado.** É um histórico, não um controle de acesso. Quem alcança a API escreve com o nome que quiser.

Para relatar uma vulnerabilidade, veja [SECURITY.md](SECURITY.md).

## Como é feito

```
  interface web ──┐
  CLI ────────────┼──►  API REST ─┐
  Claude / Codex ─┴──►  MCP ──────┴──►  núcleo (nucleo.ts)  ──►  SQLite
                                               │
                                     histórico com autoria
```

- **Um núcleo só.** `server/src/nucleo.ts` tem todas as regras; REST e MCP são camadas finas sobre ele.
- **SQLite**, não Postgres: um arquivo, backup com `cp`, nada para manter rodando.
- **MCP sem estado.** Cada requisição cria o seu transporte; não há sessão para expirar.
- **Posições em float** com passo de 1000: reordenar é tirar a média entre os vizinhos.
- **Arrastar e soltar nativo** do HTML5, sem biblioteca.
- **Consulta a cada 4 segundos** com comparação de assinatura: o quadro só redesenha quando algo mudou.

## Limitações conhecidas

- Consulta periódica, não WebSocket: a mudança de outra sessão aparece em até 4 segundos.
- Sem contas de usuário. Veja o modelo de segurança acima.
- Interface e nomes da API só em português.
- Os lembretes aparecem no quadro e ficam disponíveis para os agentes; nada é enviado para celular ou e-mail.

## Contribuindo

Issues e pull requests são bem-vindos. Leia antes o [CONTRIBUTING.md](CONTRIBUTING.md); se trabalhar com um agente de IA, aponte-o para o [AGENTS.md](AGENTS.md).

## Licença

[MIT](LICENSE)
