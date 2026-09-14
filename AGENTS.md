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
