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

Código, comentários, interface e nomes da API em português. Não traduza o que
existe. As exceções são os documentos voltados a quem chega pelo GitHub:
`README.md`, `CHANGELOG.md`, `SECURITY.md` e a primeira metade do
`CONTRIBUTING.md` são em inglês, e o `README.pt-BR.md` é o espelho em português.
Mexeu num README? Atualize os dois.

### 7. Comentários explicam *por quê*

`// incrementa o contador` é ruído. `// float com espaçamento largo para que
reordenar seja só a média entre vizinhos` é útil. Se o código é óbvio, não
comente.

## Antes de dizer que terminou

```bash
cd server && npm run typecheck && npm test && npm run build && node verificar-integracao.mjs
cd web    && npm run lint && npm run build
```

Todos precisam passar. Se você mexeu no `nucleo.ts`, **escreva teste** —
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

Descreva no pull request (ou num `RELATORIO.md` local, que o git ignora): o que
mudou em cada arquivo, o que você tentou e não funcionou, e qualquer decisão que
tomou sem ter sido instruído. Atualize o `CHANGELOG.md`.

Se algo na tarefa parecia errado, **diga em vez de silenciosamente fazer
diferente**.

## Contratos das funções mais novas

A referência de rotas REST e ferramentas MCP, com um exemplo de cada, está em
[docs/API.md](docs/API.md). Rotas e ferramentas antigas continuam compatíveis.

- No início da sessão, consulte também `lembretes_pendentes` (ou `GET /api/lembretes`).
- **Migrações aditivas.** Nunca reescreva campos existentes ao migrar.
- **Vários quadros.** Sem dizer qual, tudo vale para o quadro principal (o mais antigo).
  `resolverQuadro` aceita id ou nome. Mover um card pelo nome da coluna procura a coluna
  no quadro do próprio card. Só se apaga quadro vazio, contando os arquivados.
- **Repetição** exige transação com movimento e geração; não remova os índices UNIQUE de
  série/período ou de origem. Pause ou encerre pelo núcleo. Nunca apague uma ocorrência
  para desfazer um movimento.
- **Upload** passa por `validarWallpaper` no núcleo (8 MB, sem SVG, nome gerado pelo
  servidor). `BOARD_DADOS` isola os arquivos em testes. Não sirva caminhos de arquivo
  fornecidos pelo cliente.
- **Limites de entrada** (título, descrição, comentário, projeto, autor) ficam no núcleo
  e em `registrar`, para valerem igual em REST e MCP.
- **Segurança da API** (`server/src/index.ts`): sem chave não há CORS e o servidor recusa
  `Host` e origem desconhecidos. Não volte a ligar `cors()` para qualquer origem.
- Depois dos builds, rode também `cd server && node verificar-integracao.mjs`. Ele sobe um
  processo com banco descartável dentro do repositório e confere REST e MCP.
