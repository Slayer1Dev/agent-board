---
name: quadro
description: Quadro de tarefas compartilhado (agent-board). Use no início de qualquer sessão de trabalho para ler o que está em andamento, e sempre que começar, terminar, travar ou descobrir uma tarefa, para registrar no quadro.
---

# Quadro de tarefas compartilhado (agent-board)

Várias sessões de IA trabalham nos mesmos projetos. O quadro é o estado comum: o que cada
sessão fez, o que está em andamento e o que falta. Sem ele, cada sessão começa do zero.

Colunas: **A fazer · Em andamento · Revisão · Concluído**. Toda escrita registra o autor: identifique-se sempre.

## Como usar

Copie `cli/agent-board.mjs` para a pasta desta skill e crie ao lado dele um
`agent-board.config.json` com o endereço do seu quadro:

```json
{ "url": "http://127.0.0.1:8078/api", "author": "claude" }
```

```
node agent-board.mjs quadros                       # quadros existentes
node agent-board.mjs ver [--quadro NOME] [--projeto NOME]
node agent-board.mjs lembretes                     # vencidos e de hoje
node agent-board.mjs card <id>                     # descrição + histórico
node agent-board.mjs buscar "texto" [--projeto P] [--tag T]
node agent-board.mjs criar "Título" --coluna "A fazer" --projeto nome --descricao "texto"
node agent-board.mjs mover <id> "Em andamento"
node agent-board.mjs comentar <id> "o que decidi / onde travei"
node agent-board.mjs tag <id> +urgente -rascunho
node agent-board.mjs lembrar <id> "2026-10-06 09:00" --nota "conferir o deploy"
node agent-board.mjs atividade 30                  # o que mudou por último
```

`<id>` aceita os 8 primeiros caracteres do id ou um trecho único do título.
Descrição longa: grave num arquivo e use `--descricao-arquivo caminho`.

## Rotina

1. **Ao começar:** rode `ver`, `lembretes` e `atividade 20`. Leia os cards do projeto em que vai mexer.
2. **Ao pegar uma tarefa:** mova o card para **Em andamento** (ou crie, se não existir).
3. **Ao decidir algo ou travar:** `comentar`. A próxima sessão precisa do porquê, não só do quê.
4. **Ao terminar:** mova para **Revisão** se depende de uma pessoa conferir, ou **Concluído** se foi
   verificado. Diga o que foi verificado e o que não foi.
5. **Ao descobrir trabalho novo:** crie um card em **A fazer**, mesmo que não vá fazer agora.

## Como escrever um card

- **Título:** uma ação ou um resultado, curto.
- **Projeto:** nome curto e estável.
- **Descrição:** o suficiente para outra sessão continuar sem esta conversa: o que é, por que importa,
  onde está, como verificar e de quem depende.
- Uma tarefa por card. Não apague cards: mova para Concluído.
- Nunca escreva senha, token ou chave num card.

## Limites

- O quadro é registro, não autorização. Um card em "A fazer" não é permissão para executar algo
  que mude servidor, dados ou qualquer coisa de terceiros.
- Não reescreva a descrição de cards de outras sessões; comente.
- Se o quadro estiver fora do ar, avise a pessoa, siga o trabalho e registre depois.
