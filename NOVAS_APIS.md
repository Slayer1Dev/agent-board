# Busca, tags, filtros, projetos, lembretes, repetição e wallpapers

Entrega de 04/10/2026 na branch `feat/busca-tags-lembretes`. Contratos anteriores preservados. Sem dependências novas.

## Chamadas REST

Base: `http://127.0.0.1:8078/api`. Escritas usam `x-autor: codex` (o card final de revisão usa `astra`, conforme pedido). A API direta em `127.0.0.1:8078` exige a chave configurada; nunca grave a chave em um card. Nos exemplos abaixo, `CARD`, `TAG` e `WALLPAPER` são IDs reais obtidos das consultas.

| Método e rota | Exemplo de caminho / corpo JSON |
|---|---|
| GET `/cards` | `/cards?busca=taxas` — inclui arquivados e devolve `trecho`, `coluna`, tags e metadados |
| GET `/cards` com filtros | `/cards?projeto=agent-board&tag=TAG&autor=codex&coluna=Revis%C3%A3o&depende=true&lembrete=true&repetida=true&dias=7&periodo=alterado&arquivados=false` |
| GET `/tags` | `/tags` |
| POST `/tags` | `{"nome":"Urgente","cor":"#f4abb9"}` — cor é opcional |
| PATCH `/tags/TAG` | `{"nome":"Prioridade"}` — preserva a cor |
| DELETE `/tags/TAG` | Sem corpo; remove associações com histórico, preserva os cards |
| PUT `/cards/CARD/tags` | `{"tags":["TAG"],"revisao":3}` — substitui a lista completa; `[]` remove todas |
| POST `/cards` (campo novo) | `{"titulo":"Conferir entrega","projeto":"agent-board","coluna":"A fazer","tags":["TAG"]}` |
| GET `/projetos` | `/projetos?ordem=atividade&ocultos=true`; `ordem=nome` também disponível |
| PATCH `/projetos/agent-board` | `{"cor":"#a5c8ff","favorito":true,"oculto":false}` |
| GET `/lembretes` | `/lembretes` — vencidos e de hoje em São Paulo, excluindo feitos e arquivados |
| PUT `/cards/CARD/lembrete` | `{"data":"2026-10-05T09:00:00-03:00","nota":"Conferir a entrega","revisao":3}`; `data:null` remove |
| POST `/cards/CARD/lembrete` | `{"acao":"hora","revisao":4}` — `feito`, `hora`, `amanha` ou `semana` |
| PUT `/cards/CARD/repeticao` | `{"regra":{"frequencia":"semanal","dias":[1,3,5]},"revisao":3}` |
| POST `/cards/CARD/repeticao` | `{"estado":"pausada","revisao":4}` — `ativa`, `pausada` ou `encerrada` |
| GET `/wallpapers` | `/wallpapers` — IDs, URLs, formato, autor e data |
| POST `/wallpapers` | Corpo **binário**, cabeçalho `Content-Type: application/octet-stream`, arquivo PNG/JPG/WebP até 8 MB |
| GET `/wallpapers/WALLPAPER/arquivo` | Bytes da imagem, MIME detectado no servidor e `X-Content-Type-Options: nosniff` |
| DELETE `/wallpapers/WALLPAPER` | Sem corpo; também limpa seleção se era o atual |
| GET `/aparencia` | `/aparencia` — `{"wallpaper":"ID ou null","url":"..."}` |
| PUT `/aparencia` | `{"wallpaper":"WALLPAPER"}`; `null` seleciona fundo sem imagem |

Exemplos completos (shell no servidor ou outra máquina com curl):

```sh
QUADRO_API=http://127.0.0.1:8078/api
curl -fsS "$QUADRO_API/cards?busca=taxas&arquivados=false"
curl -fsS "$QUADRO_API/tags" -H 'x-autor: codex' -H 'Content-Type: application/json' -d '{"nome":"Urgente"}'
curl -fsS "$QUADRO_API/cards/CARD/lembrete" -X PUT -H 'x-autor: codex' -H 'Content-Type: application/json' -d '{"data":"2026-10-05T09:00:00-03:00","nota":"Conferir entrega"}'
curl -fsS "$QUADRO_API/wallpapers" -H 'x-autor: codex' -H 'Content-Type: application/octet-stream' --data-binary @/caminho/imagem.png
```

## Ferramentas MCP novas

Cada linha é um exemplo de `tools/call`: use `name` com o nome indicado e `arguments` com o JSON da segunda coluna. Endpoint `/mcp` continua stateless e exige a autenticação configurada.

| Ferramenta | `arguments` de exemplo |
|---|---|
| `pesquisar_cards` | `{"busca":"taxas"}` |
| `filtrar_cards` | `{"projeto":"agent-board","depende":true,"dias":7,"periodo":"alterado","arquivados":false}` |
| `listar_tags` | `{}` |
| `criar_tag` | `{"nome":"Urgente","cor":"#f4abb9","autor":"codex"}` |
| `alterar_tag` | `{"id":"TAG","nome":"Prioridade","autor":"codex"}`; exclusão: `{"id":"TAG","apagar":true,"autor":"codex"}` |
| `definir_tags` | `{"id":"CARD","tags":["TAG"],"autor":"codex"}` |
| `listar_projetos` | `{"ordem":"atividade","ocultos":true}` |
| `atualizar_projeto` | `{"nome":"agent-board","favorito":true,"oculto":false,"cor":"#a5c8ff","autor":"codex"}` |
| `lembretes_pendentes` | `{}` |
| `definir_lembrete` | `{"id":"CARD","data":"2026-10-05T09:00:00-03:00","nota":"Conferir entrega","autor":"codex"}` |
| `agir_lembrete` | `{"id":"CARD","acao":"feito","autor":"codex"}` |
| `definir_repeticao` | `{"id":"CARD","regra":{"frequencia":"mensal","dia":31},"autor":"codex"}` |
| `agir_repeticao` | `{"id":"CARD","estado":"pausada","autor":"codex"}` |
| `listar_wallpapers` | `{}` |
| `obter_wallpaper` | `{"id":"WALLPAPER"}` — retorna MIME e base64 |
| `enviar_wallpaper` | `{"base64":"BASE64_DA_IMAGEM","autor":"codex"}` |
| `apagar_wallpaper` | `{"id":"WALLPAPER","autor":"codex"}` |
| `ver_aparencia` | `{}` |
| `escolher_wallpaper` | `{"id":"WALLPAPER","autor":"codex"}`; `id:null` remove seleção |

`criar_card` agora aceita `tags:["TAG"]`, mantendo os parâmetros antigos. `filtrar_cards` aceita os mesmos filtros da tabela REST como booleanos/números nativos. `autor` no filtro significa autor **de criação**, não último comentário. `depende:true` significa coluna **Revisão**. `periodo` aceita `criado` e `alterado`; `dias` é um intervalo móvel de N×24 horas. Tag pode ser ID ou nome. Projeto `__sem__` filtra cards sem projeto. A busca é substring sem distinção de maiúsculas, preservando acentos. Pesquisa global e filtros na visão são controles independentes.

Exemplo de envelope MCP:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lembretes_pendentes","arguments":{}}}
```

## Semântica e decisões

- As escritas novas em cards invalidam revisões antigas. A interface envia `revisao`; MCP conserva a convenção anterior de escritas sem esse parâmetro.
- Tags são IDs; nomes únicos sem distinguir maiúsculas. Criar card com tags inválidas reverte a transação inteira. Renomear e excluir tag também registram autor em cada card afetado.
- Projetos legados são lidos diretamente do campo `cards.projeto`, sem backfill. Metadados são criados apenas ao personalizar; favoritos precedem a ordenação escolhida. Contagens excluem arquivados; última atividade inclui alteração dos metadados do projeto.
- Lembretes usam ISO com fuso obrigatório, são armazenados em UTC e classificados no dia de São Paulo. Um horário que já passou hoje é `atrasado`. Amanhã/próxima semana preservam a hora atual da ação; adiamentos são a partir de agora (24 horas / 7 dias).
- Repetição usa calendário de São Paulo. Semanal: 0=domingo até 6=sábado. Mensal: dia 29/30/31 é limitado ao último dia dos meses menores. A próxima ocorrência é depois do maior entre hoje e o período do card; períodos atrasados não são gerados em lote.
- Concluir repetição copia título, descrição, projeto e tags para A fazer. Histórico registra o ID da origem. Transação e restrições UNIQUE de série/período e origem persistem entre reinícios. Mover a mesma origem novamente não gera outra ocorrência.
- Pausar/retomar/encerrar e alterar a regra afetam a série inteira, com histórico nos cards associados. Encerramento é definitivo; uma nova série começa em outro card. Ctrl+Z de movimento que já gerou ocorrência é recusado: mover manualmente preserva a ocorrência e seus comentários.
- Upload não usa nome fornecido; arquivos recebem UUID e extensão detectada. PNG verifica estrutura, CRC e descompressão; JPG e WebP verificam estrutura e dimensões. O navegador verifica decodificação antes de enviar. Não há decodificador completo de JPG/WebP no servidor. Limites adicionais: 16 milhões de pixels / 8192 px por lado; WebP animado não é aceito.
- A galeria e a escolha ficam no servidor. Tema/largura/fundo continuam locais. Wallpaper antigo em data URL é enviado quando aquele navegador abre a nova versão e o servidor ainda não tem seleção. Imagens autenticadas são carregadas como blobs na interface; nenhum recurso externo é necessário.

## Conectar notificações depois

Um consumidor no serviço à parte pode consultar `GET /api/lembretes` ou `lembretes_pendentes` em intervalos, deduplicar por `(card.id, lembrete_em)` e então enviar ao Telegram/e-mail. A consulta só lê; para marcar feito use a ação explícita. Este trabalho não instalou consumidor nem envio externo.

## Verificação e retorno

```sh
cd ~/agent-board/server
npm test && npm run build && npx tsc --noEmit
node verificar-integracao.mjs
cd ../web
npm run lint && npm run build && npx tsc --noEmit
```

Retorno ao visual/código anterior, mantendo banco, metadados novos e alterações locais de dependências:

```sh
ssh SEU_SERVIDOR 'export PATH=$HOME/.nvm/versions/node/current/bin:$PATH; cd ~/agent-board && git switch design/header-claude && (cd server && npm run build) && (cd web && npm run build) && systemctl --user restart agent-board agent-board-web'
```

Não restaurar o banco para voltar o código. Na branch antiga lembretes/repetições novos ficam sem interface e sem geração, mas continuam guardados para quando esta branch voltar. Backup inicial validado: `~/backups/agent-board-2026-10-04-2317/`.
