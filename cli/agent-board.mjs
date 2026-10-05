#!/usr/bin/env node
// agent-board CLI — read and write the board from any terminal or AI session.
// Node 18+, no dependencies. Commands and output are in Portuguese, like the API.
//
//   node agent-board.mjs quadros                      # lista os quadros
//   node agent-board.mjs ver [--quadro NOME] [--projeto NOME] [--coluna NOME]
//   node agent-board.mjs card <id>
//   node agent-board.mjs criar "Título" [--quadro NOME] [--coluna "A fazer"] [--projeto NOME] [--tags a,b] [--descricao "texto" | --descricao-arquivo caminho]
//   node agent-board.mjs mover <id> "Coluna"
//   node agent-board.mjs comentar <id> "texto"
//   node agent-board.mjs atualizar <id> [--titulo "..."] [--descricao "..."] [--projeto NOME]
//   node agent-board.mjs buscar "texto" [--projeto P] [--tag T] [--coluna C] [--autor A] [--dias N]
//   node agent-board.mjs tags                         # lista as tags
//   node agent-board.mjs tag <id> +urgente -rascunho  # põe e tira tags de um card (cria a tag se não existir)
//   node agent-board.mjs lembretes                    # lembretes vencidos e de hoje
//   node agent-board.mjs lembrar <id> "2026-10-06 09:00" [--nota "texto"]   |   lembrar <id> nunca
//   node agent-board.mjs projetos
//   node agent-board.mjs atividade [limite]
//   node agent-board.mjs lote <arquivo.json>          # [{ titulo, coluna, projeto, descricao }, ...]
//   node agent-board.mjs backups                      # onde ficam e quais existem
//   node agent-board.mjs backup                       # faz um backup agora
//
// <id> can be the first characters of the id (8 are enough) or a unique part of the title.
//
// Configuration, in order of precedence:
//   1. flags:        --url, --autor
//   2. environment:  AGENT_BOARD_URL, AGENT_BOARD_KEY, AGENT_BOARD_AUTHOR
//   3. a file named agent-board.config.json next to this script: { "url": "...", "key": "...", "author": "..." }
//   4. default url:  http://127.0.0.1:8078/api
// The author is required for every write: the history with authorship is the point of the board.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opcoes = {};
const livres = [];
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  // "+tag" e "-tag" são argumentos livres do comando `tag`; só "--nome valor" é opção.
  if (a.startsWith('--')) {
    opcoes[a.slice(2)] = args[i + 1];
    i += 1;
  } else livres.push(a);
}
const [comando, ...resto] = livres;

function lerConfig() {
  const arquivo = join(dirname(fileURLToPath(import.meta.url)), 'agent-board.config.json');
  if (!existsSync(arquivo)) return {};
  try {
    return JSON.parse(readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new Error(`agent-board.config.json inválido: ${e.message}`);
  }
}
const config = lerConfig();
const env = process.env;
const BASE = String(opcoes.url || env.AGENT_BOARD_URL || env.QUADRO_URL || config.url || 'http://127.0.0.1:8078/api').replace(/\/+$/, '');
const CHAVE = env.AGENT_BOARD_KEY || env.QUADRO_KEY || config.key || '';
const AUTOR = opcoes.autor || env.AGENT_BOARD_AUTHOR || env.QUADRO_AUTOR || config.author || '';

// Comandos que não registram autor: as leituras e o backup, que não muda o quadro.
const LEITURA = new Set(['quadros', 'ver', 'card', 'buscar', 'tags', 'lembretes', 'projetos', 'atividade', 'backups', 'backup']);

// Cabeçalhos HTTP só aceitam ASCII: tira acentos do autor em vez de falhar.
const asciiAutor = (s) => s.normalize('NFD').replace(/[^\x20-\x7e]/g, '');

async function api(metodo, caminho, corpo) {
  let resp;
  try {
    resp = await fetch(BASE + caminho, {
      method: metodo,
      headers: {
        ...(AUTOR ? { 'x-autor': asciiAutor(AUTOR) } : {}),
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        ...(CHAVE ? { Authorization: `Bearer ${CHAVE}` } : {}),
      },
      body: corpo ? JSON.stringify({ ...corpo, autor: AUTOR }) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error(`Quadro inalcançável em ${BASE} (${e.message}). O servidor está no ar? A URL está certa (AGENT_BOARD_URL)?`);
  }
  const texto = await resp.text();
  let dados = null;
  try {
    dados = JSON.parse(texto);
  } catch {
    dados = texto;
  }
  if (resp.status === 401) throw new Error('Quadro respondeu 401: chave ausente ou errada (AGENT_BOARD_KEY).');
  if (!resp.ok) throw new Error(`Quadro respondeu ${resp.status}: ${dados?.erro || texto.slice(0, 200)}`);
  return dados;
}

const curto = (id) => String(id).slice(0, 8);
const texto1 = (t, n = 110) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const etiquetas = (k) => (k.tags?.length ? `  #${k.tags.map((t) => t.nome).join(' #')}` : '');
const linhaBackup = (b) => `  ${b.criado_em}  ${b.cards < 0 ? 'ILEGÍVEL' : `${b.cards} cards`}  ${Math.ceil(b.bytes / 1024)} KB  ${b.wallpapers} wallpaper(s)  ${b.nome}`;
const linhaCard = (k) => `  ${curto(k.id)}  ${k.projeto ? `[${k.projeto}] ` : ''}${k.titulo}${etiquetas(k)}`;

async function resolver(ref) {
  if (!ref) throw new Error('Informe o id (ou o começo dele, ou um trecho do título) do card.');
  // /cards devolve os cards de todos os quadros, já com o nome da coluna.
  const todos = await api('GET', '/cards?arquivados=false');
  let achados = todos.filter((k) => k.id === ref || k.id.startsWith(ref));
  if (achados.length === 0) achados = todos.filter((k) => k.titulo.toLowerCase().includes(String(ref).toLowerCase()));
  if (achados.length === 0) throw new Error(`Nenhum card com id ou título contendo "${ref}".`);
  if (achados.length > 1) throw new Error(`"${ref}" é ambíguo:\n${achados.map((k) => `  ${curto(k.id)}  ${k.titulo}`).join('\n')}`);
  return achados[0];
}

// Aceita nomes de tag e devolve ids; com `criar`, cria as que faltam.
async function idsDeTags(nomes, criar) {
  const existentes = await api('GET', '/tags');
  const ids = [];
  for (const nome of nomes) {
    let tag = existentes.find((t) => t.nome.toLowerCase() === nome.toLowerCase());
    if (!tag && criar) tag = await api('POST', '/tags', { nome });
    if (!tag) throw new Error(`Tag "${nome}" não existe. Tags: ${existentes.map((t) => t.nome).join(', ') || '(nenhuma)'}`);
    ids.push(tag.id);
  }
  return ids;
}

// "2026-10-06 09:00" no fuso desta máquina → ISO com fuso, que é o que a API exige.
function dataParaApi(texto) {
  const d = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(texto) ? texto : texto.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: "${texto}". Use "AAAA-MM-DD HH:MM".`);
  return d.toISOString();
}

const comandos = {
  async quadros() {
    const lista = await api('GET', '/quadros');
    lista.forEach((q, i) => console.log(`  ${q.nome.padEnd(28)} ${String(q.cards).padStart(4)} cards${i === 0 ? '   (principal)' : ''}`));
  },
  async ver() {
    const quadro = await api('GET', `/quadro${opcoes.quadro ? `?quadro=${encodeURIComponent(opcoes.quadro)}` : ''}`);
    console.log(`Quadro "${quadro.nome}" — ${BASE.replace(/\/api$/, '')}`);
    for (const c of quadro.colunas) {
      if (opcoes.coluna && c.nome.toLowerCase() !== opcoes.coluna.toLowerCase()) continue;
      const cards = c.cards.filter((k) => !opcoes.projeto || (k.projeto || '').toLowerCase() === opcoes.projeto.toLowerCase());
      console.log(`\n${c.nome.toUpperCase()} (${cards.length})`);
      for (const k of cards) console.log(linhaCard(k));
    }
  },
  async card() {
    const k = await resolver(resto[0]);
    const d = await api('GET', `/cards/${k.id}`);
    const c = d.card || d;
    console.log(`${c.titulo}\nid: ${c.id}\ncoluna: ${k.coluna}${c.projeto ? ` · projeto: ${c.projeto}` : ''}${etiquetas(c)}\ncriado: ${c.criado_em} · atualizado: ${c.atualizado_em}`);
    if (c.lembrete_em) console.log(`lembrete: ${c.lembrete_em}${c.lembrete_estado ? ` (${c.lembrete_estado})` : ''}${c.lembrete_nota ? ` — ${c.lembrete_nota}` : ''}`);
    if (c.repeticao) console.log(`repetição: ${c.repeticao.regra?.frequencia} (${c.repeticao.estado}) · próxima: ${c.repeticao.proxima}`);
    console.log(`\n${c.descricao || '(sem descrição)'}`);
    const historico = d.historico || d.eventos || d.atividade || c.historico || [];
    if (historico.length) {
      console.log('\nHistórico:');
      for (const h of historico) console.log(`  ${h.criado_em || ''}  ${h.autor || '?'}: ${h.acao || ''} ${texto1(h.detalhe || '', 300)}`);
    }
  },
  async criar() {
    const titulo = resto[0];
    if (!titulo) throw new Error('Informe o título.');
    const descricao = opcoes['descricao-arquivo'] ? readFileSync(opcoes['descricao-arquivo'], 'utf8') : opcoes.descricao;
    const tags = opcoes.tags ? await idsDeTags(opcoes.tags.split(',').map((t) => t.trim()).filter(Boolean), true) : undefined;
    const c = await api('POST', '/cards', { titulo, coluna: opcoes.coluna || 'A fazer', projeto: opcoes.projeto, descricao, tags, quadro: opcoes.quadro });
    console.log(`criado ${curto(c.id)}  ${c.titulo}`);
  },
  async mover() {
    const k = await resolver(resto[0]);
    if (!resto[1]) throw new Error('Informe a coluna de destino.');
    await api('POST', `/cards/${k.id}/mover`, { coluna: resto[1] });
    console.log(`movido ${curto(k.id)}  ${k.titulo}  →  ${resto[1]}`);
  },
  async comentar() {
    const k = await resolver(resto[0]);
    if (!resto[1]) throw new Error('Informe o texto do comentário.');
    await api('POST', `/cards/${k.id}/comentarios`, { texto: resto[1] });
    console.log(`comentado ${curto(k.id)}  ${k.titulo}`);
  },
  async atualizar() {
    const k = await resolver(resto[0]);
    const mudancas = {};
    for (const campo of ['titulo', 'descricao', 'projeto']) if (opcoes[campo] !== undefined) mudancas[campo] = opcoes[campo];
    if (opcoes['descricao-arquivo']) mudancas.descricao = readFileSync(opcoes['descricao-arquivo'], 'utf8');
    if (!Object.keys(mudancas).length) throw new Error('Nada a atualizar: use --titulo, --descricao ou --projeto.');
    await api('PATCH', `/cards/${k.id}`, mudancas);
    console.log(`atualizado ${curto(k.id)}  ${mudancas.titulo || k.titulo}`);
  },
  async buscar() {
    const q = new URLSearchParams();
    if (resto[0]) q.set('busca', resto[0]);
    for (const f of ['quadro', 'projeto', 'coluna', 'autor', 'dias']) if (opcoes[f] !== undefined) q.set(f, opcoes[f]);
    if (opcoes.tag) q.set('tag', (await idsDeTags([opcoes.tag], false))[0]);
    if (![...q.keys()].length) throw new Error('Informe um texto ou um filtro (--quadro, --projeto, --tag, --coluna, --autor, --dias).');
    const cards = await api('GET', `/cards?${q}`);
    console.log(`${cards.length} card(s)`);
    for (const k of cards) console.log(`${linhaCard(k)}${k.arquivado_em ? '  (arquivado)' : ''}`);
  },
  async tags() {
    const lista = await api('GET', '/tags');
    if (!lista.length) console.log('(nenhuma tag)');
    for (const t of lista) console.log(`  ${t.nome}  ${t.cor}`);
  },
  async tag() {
    const k = await resolver(resto[0]);
    const por = resto.slice(1).filter((t) => t.startsWith('+')).map((t) => t.slice(1));
    const tirar = resto.slice(1).filter((t) => t.startsWith('-')).map((t) => t.slice(1).toLowerCase());
    if (!por.length && !tirar.length) throw new Error('Use +nome para pôr e -nome para tirar. Ex.: tag 1a2b3c4d +urgente -rascunho');
    const atuais = (k.tags || []).filter((t) => !tirar.includes(t.nome.toLowerCase())).map((t) => t.id);
    const novas = await idsDeTags(por, true);
    const c = await api('PUT', `/cards/${k.id}/tags`, { tags: [...new Set([...atuais, ...novas])] });
    console.log(`tags de ${curto(k.id)}:${etiquetas(c.card || c) || ' (nenhuma)'}`);
  },
  async lembretes() {
    const lista = await api('GET', '/lembretes');
    if (!lista.length) console.log('(nenhum lembrete vencido ou para hoje)');
    for (const k of lista) console.log(`  ${curto(k.id)}  ${k.lembrete_em}  ${k.lembrete_estado || ''}  ${k.titulo}${k.lembrete_nota ? ` — ${k.lembrete_nota}` : ''}`);
  },
  async lembrar() {
    const k = await resolver(resto[0]);
    if (!resto[1]) throw new Error('Informe a data ("AAAA-MM-DD HH:MM") ou "nunca" para remover.');
    const data = resto[1].toLowerCase() === 'nunca' ? null : dataParaApi(resto[1]);
    await api('PUT', `/cards/${k.id}/lembrete`, { data, nota: opcoes.nota || '' });
    console.log(data ? `lembrete de ${curto(k.id)} em ${data}` : `lembrete de ${curto(k.id)} removido`);
  },
  async projetos() {
    const lista = await api('GET', `/projetos${opcoes.quadro ? `?quadro=${encodeURIComponent(opcoes.quadro)}` : ''}`);
    for (const p of lista) console.log(`  ${p.favorito ? '★' : ' '} ${p.nome.padEnd(26)} ${p.colunas.map((c) => `${c.nome}: ${c.total}`).join(' · ')}   (${p.ultima_atividade || 'sem atividade'})`);
  },
  async atividade() {
    const lista = await api('GET', `/atividade?limite=${Number(resto[0]) || 20}`);
    for (const a of lista) console.log(`${a.criado_em || ''}  ${a.autor || '?'}  ${a.acao || ''}  ${texto1(a.card_titulo || a.detalhe || '', 120)}`);
  },
  async lote() {
    const itens = JSON.parse(readFileSync(resto[0], 'utf8').replace(/^﻿/, ''));
    for (const item of itens) {
      const c = await api('POST', '/cards', { titulo: item.titulo, coluna: item.coluna || 'A fazer', projeto: item.projeto, descricao: item.descricao });
      console.log(`criado ${curto(c.id)}  [${item.coluna || 'A fazer'}] ${c.titulo}`);
    }
  },
  async backups() {
    const e = await api('GET', '/backups');
    console.log(`pasta: ${e.pasta}\n${e.automatico ? `automático a cada ${e.intervalo_horas} h` : 'automático DESLIGADO'} · guarda os ${e.manter} mais recentes`);
    if (!e.backups.length) console.log('(nenhum backup ainda)');
    for (const b of e.backups) console.log(linhaBackup(b));
  },
  async backup() {
    console.log(`feito${linhaBackup(await api('POST', '/backups', {}))}`);
  },
};

if (!comandos[comando]) {
  console.log('uso: agent-board.mjs quadros | ver [--quadro Q] | card <id> | criar "Título" [--coluna C] [--projeto P] [--tags a,b] [--descricao T] | mover <id> "Coluna" | comentar <id> "texto" | atualizar <id> [--titulo|--descricao|--projeto] | buscar "texto" [--projeto|--tag|--coluna|--autor|--dias] | tags | tag <id> +nome -nome | lembretes | lembrar <id> "AAAA-MM-DD HH:MM" [--nota T] | projetos | atividade [n] | lote arquivo.json | backups | backup\nopções globais: --autor NOME  --url http://host:porta/api');
  process.exit(comando ? 2 : 0);
}
if (!LEITURA.has(comando) && !AUTOR) {
  console.error('Diga quem você é: --autor NOME ou AGENT_BOARD_AUTHOR. Toda escrita no quadro registra o autor.');
  process.exit(2);
}
comandos[comando]().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
