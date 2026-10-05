# Referência da API

Rotas REST e ferramentas MCP do agent-board, com um exemplo de cada. As duas vias usam o mesmo
núcleo (`server/src/nucleo.ts`), então fazem exatamente a mesma coisa.

- Base REST: `http://127.0.0.1:8078/api`. MCP: `POST http://127.0.0.1:8078/mcp` (HTTP, sem estado).
- Com `BOARD_API_KEY` definida, mande `Authorization: Bearer <chave>` em toda requisição.
- Toda escrita precisa de autor: cabeçalho `x-autor` no REST, campo `autor` no MCP (até 60 caracteres).
- Nos exemplos, `CARD`, `TAG`, `QUADRO` e `WALLPAPER` são ids obtidos das consultas.
- Escritas em card aceitam `revisao` (o número que veio na leitura). Se o card mudou nesse meio
  tempo, a escrita é recusada em vez de sobrescrever.

## Quadro, cards e colunas

| Método e rota | Exemplo de caminho / corpo JSON |
|---|---|
| GET `/quadro` | `/quadro` devolve o quadro principal com colunas e cards; `/quadro?id=QUADRO` (id ou nome) escolhe outro |
| GET `/quadros` | Lista os quadros com a contagem de cards ativos. O primeiro é o principal |
| POST `/quadros` | `{"nome":"Estudos"}` cria o quadro já com as colunas A fazer, Em andamento, Revisão e Concluído |
| PATCH `/quadros/QUADRO` | `{"nome":"Faculdade"}` |
| DELETE `/quadros/QUADRO` | Sem corpo. Só apaga quadro sem cards (contando arquivados) e nunca o único |
| GET `/cards/CARD` | Um card com todo o histórico (`eventos`) |
| POST `/cards` | `{"titulo":"Conferir entrega","coluna":"A fazer","projeto":"site","descricao":"...","quadro":"Estudos"}`; `quadro` e `coluna` são opcionais |
| PATCH `/cards/CARD` | `{"titulo":"Novo título","descricao":"...","projeto":"site","revisao":3}` |
| POST `/cards/CARD/mover` | `{"coluna":"Em andamento"}`: o nome da coluna vale dentro do quadro do card |
| POST `/cards/CARD/comentarios` | `{"texto":"Decidi usar X porque Y."}` |
| POST `/cards/CARD/arquivar` · `/restaurar` | `{"revisao":3}` |
| GET `/arquivados` | Cards arquivados |
| POST `/acoes/ACAO/desfazer` | Desfaz a ação cujo id veio em `acao_id` na resposta de uma escrita |
| DELETE `/cards/CARD` | Apaga de vez. Prefira arquivar |
| POST `/colunas` | `{"nome":"Bloqueado","quadro":"Estudos"}` |
| GET `/atividade` | `/atividade?limite=30`: o que mudou por último, com autor |
| GET `/saude` (fora de `/api`) | `{"ok":true}`, sem autenticação |

## Busca, tags, filtros, projetos, lembretes, repetição e wallpapers

| Método e rota | Exemplo de caminho / corpo JSON |
|---|---|
| GET `/cards` | `/cards?busca=taxas` — inclui arquivados e devolve `trecho`, `coluna`, tags e metadados |
| GET `/cards` com filtros | `/cards?quadro=QUADRO&projeto=agent-board&tag=TAG&autor=codex&coluna=Revis%C3%A3o&depende=true&lembrete=true&repetida=true&dias=7&periodo=alterado&arquivados=false` |
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

## Backups

- `GET /api/backups` devolve `{ pasta, intervalo_horas, manter, automatico, ultimo, backups }`. Cada backup: `{ nome, criado_em, bytes, cards, wallpapers }`; `cards: -1` quer dizer que a cópia não abriu.
- `POST /api/backups` faz um backup agora e devolve o backup criado (201). Pedidos simultâneos recebem o mesmo backup.
- MCP: `ver_backups` e `fazer_backup`, sem parâmetros. Backup não registra autor nem entra no histórico: ele não muda o quadro.

```bash
curl -s http://127.0.0.1:8078/api/backups
curl -s -X POST http://127.0.0.1:8078/api/backups
```

## Ferramentas MCP

Cada linha é um exemplo de `tools/call`: use `name` com o nome indicado e `arguments` com o JSON da segunda coluna. Endpoint `/mcp` continua stateless e exige a autenticação configurada.

| Ferramenta | `arguments` de exemplo |
|---|---|
| `ver_quadro` | `{}` para o principal; `{"quadro":"Estudos"}` para outro |
| `listar_quadros` | `{}` |
| `criar_quadro` | `{"nome":"Estudos","autor":"codex"}` |
| `ver_card` | `{"id":"CARD"}` |
| `criar_card` | `{"titulo":"Conferir entrega","coluna":"A fazer","projeto":"site","quadro":"Estudos","autor":"codex"}` |
| `mover_card` | `{"id":"CARD","coluna":"Em andamento","autor":"codex"}` |
| `atualizar_card` | `{"id":"CARD","descricao":"...","autor":"codex"}` |
| `comentar_card` | `{"id":"CARD","texto":"Decidi usar X porque Y.","autor":"codex"}` |
| `remover_card` | `{"id":"CARD","autor":"codex"}` (destrutiva) |
| `ver_arquivados` · `desfazer_acao` | `{}` · `{"id":"ACAO","autor":"codex"}` |
| `atividade_recente` | `{"limite":30}` |
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

## Notificações fora do quadro

O quadro não envia lembretes para celular nem e-mail. Para ligar isso, um processo seu pode
consultar `GET /api/lembretes` (ou a ferramenta `lembretes_pendentes`) de tempos em tempos,
ignorar o que já avisou usando o par `(card.id, lembrete_em)` e mandar pelo canal que preferir.
A consulta só lê; para marcar como feito, use a ação explícita do lembrete.
