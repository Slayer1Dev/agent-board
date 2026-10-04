# Instruções para agentes neste repositório

Leia este arquivo inteiro antes de alterar qualquer coisa. Ele vale para toda
sessão de IA que trabalhe aqui — Claude, Codex, Antigravity ou outra.

## O que é este projeto

Um quadro Kanban que agentes de IA operam via MCP. A interface é para o humano;
as ferramentas MCP são para as sessões. Ambos escrevem no mesmo SQLite.

O valor do projeto não é "ter um quadro" — é **o histórico com autoria**. Toda
mudança registra quem fez. É isso que permite uma sessão descobrir o que outra
fez sem ninguém explicar.

## Estrutura

```
server/src/db.ts        schema SQLite, migrações implícitas, registro de eventos
server/src/nucleo.ts    TODA a lógica de negócio
server/src/mcp.ts       ferramentas MCP (fachada fina sobre o núcleo)
server/src/index.ts     Express: API REST + monta o MCP
web/src/                interface React
```

## Regras que não se negociam

### 1. Lógica nova vai em `nucleo.ts`

A API REST e as ferramentas MCP são **fachadas finas** sobre o núcleo. Se você
implementar uma regra direto em `index.ts` ou `mcp.ts`, os dois caminhos passam
a divergir — a interface faz uma coisa, a IA faz outra, e o bug só aparece
semanas depois.

Regra nova → `nucleo.ts` → exposta nos dois lugares.

### 2. Toda escrita registra autor

Qualquer operação que altere dados chama `registrar(cardId, autor, acao, detalhe)`.
Sem exceção. Uma escrita sem autor é um buraco no histórico, e o histórico é o
produto.

### 3. Não altere o visual sem pedido explícito

`web/src/App.css`, `web/src/index.css` e os componentes em `web/src/components/`
têm design aprovado. Não "melhore" por iniciativa própria.

### 4. Dependências: o padrão é não adicionar

O projeto tem poucas dependências de propósito. Antes de instalar qualquer
coisa, pergunte se dá para resolver com o que já existe. Drag and drop, por
exemplo, é HTML5 nativo — não troque por biblioteca.

Nunca adicione framework de CSS (Tailwind, styled-components, MUI).

### 5. TypeScript estrito

Sem `any`. Sem `@ts-ignore`. Se o tipo está difícil, o desenho provavelmente
está errado.

### 6. Português

Código, comentários, interface e documentação em português. Não traduza o que
existe nem escreva em inglês.

### 7. Comentários explicam *por quê*

`// incrementa o contador` é ruído. `// float com espaçamento largo para que
reordenar seja só a média entre vizinhos` é útil. Se o código é óbvio, não
comente.

## Antes de dizer que terminou

```bash
cd server && npx tsc --noEmit && npm test
cd web    && npx tsc --noEmit && npm run build
```

Os quatro precisam passar. Se você mexeu no `nucleo.ts`, **escreva teste** —
é lógica pura sobre SQLite, não tem desculpa.

## Armadilhas conhecidas

- **`better-sqlite3` é binário nativo.** Mudar a versão do Node exige recompilar.
- **Posições são float com passo 1000.** Reordenar é calcular a média entre
  vizinhos. Não troque por inteiro sequencial — isso obrigaria a reescrever a
  coluna inteira a cada movimento.
- **O MCP é stateless de propósito.** Cada requisição cria seu transporte. Não
  introduza estado de sessão sem necessidade real.
- **O poll da interface compara assinatura antes de re-renderizar.** Se você
  remover essa comparação, o quadro pisca a cada 4 segundos.
- **`autor` é declarado, não verificado.** É assumido: uso pessoal. Não trate
  como controle de acesso.

## O que fazer quando terminar

Escreva um `RELATORIO.md` na raiz com: o que mudou em cada arquivo, o que você
tentou e não funcionou, e qualquer decisão que tomou sem ter sido instruído.

Se algo na tarefa parecia errado, **diga no relatório em vez de silenciosamente
fazer diferente**.

## Contratos adicionais (04/10/2026)

Leia [NOVAS_APIS.md](NOVAS_APIS.md) antes de operar as funções novas. A documentação contém exemplos de cada rota/ferramenta. Rotas antigas continuam compatíveis.

- REST: GET /cards (busca + filtros); GET/POST /tags; PATCH/DELETE /tags/:id; PUT /cards/:id/tags; GET /projetos; PATCH /projetos/:nome; GET /lembretes; PUT/POST /cards/:id/lembrete; PUT/POST /cards/:id/repeticao; GET/POST /wallpapers; GET /wallpapers/:id/arquivo; DELETE /wallpapers/:id; GET/PUT /aparencia. POST /cards aceita tags opcionais.
- MCP: pesquisar_cards, filtrar_cards, listar_tags, criar_tag, alterar_tag, definir_tags, listar_projetos, atualizar_projeto, lembretes_pendentes, definir_lembrete, agir_lembrete, definir_repeticao, agir_repeticao, listar_wallpapers, obter_wallpaper, enviar_wallpaper, apagar_wallpaper, ver_aparencia, escolher_wallpaper. criar_card aceita tags opcionais.
- No início da sessão, consulte também lembretes_pendentes (ou GET /api/lembretes).
- Migrações aditivas: tags/card_tags, projetos, repeticoes/ocorrencias, wallpapers/preferencias e campos de lembrete/repeticao_id nos cards. Nunca reescreva campos existentes ao migrar.
- Repetição exige transação com movimento e geração; não remova índices UNIQUE de série/período ou origem. Pause/encerre via núcleo, com autoria em toda a série. Nunca apague ocorrência para desfazer um movimento.
- Upload deve passar por validarWallpaper no núcleo (8 MB; sem SVG; nome gerado pelo servidor). BOARD_DADOS permite isolar arquivos em testes; produção usa a pasta do BOARD_DB. Não sirva caminhos de arquivo fornecidos pelo cliente.
- Verifique também `cd server && node verificar-integracao.mjs` depois dos builds. O teste reinicia processo com banco descartável dentro do repositório; não toca produção.