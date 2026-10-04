import garantir from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

// Banco e wallpapers descartáveis dentro do repositório, sem tocar produção.
const pasta = mkdtempSync(join(process.cwd(), '.integracao-'))
const base = 'http://127.0.0.1:18078'
const cabecalhos = { Authorization: 'Bearer teste-integracao', 'x-autor': 'codex-integracao', 'Content-Type': 'application/json' }
let processo
async function iniciar() {
  processo = spawn(process.execPath, ['dist/index.js'], { env: { ...process.env, BOARD_DB: join(pasta, 'board.db'), BOARD_DADOS: pasta, BOARD_PORT: '18078', BOARD_HOST: '127.0.0.1', BOARD_API_KEY: 'teste-integracao' }, stdio: 'ignore' })
  for (let n = 0; n < 80; n++) {
    try { if ((await fetch(base + '/saude')).ok) return } catch { /* Aguarda o processo abrir a porta. */ }
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('Servidor isolado não iniciou.')
}
async function parar() {
  if (!processo || processo.exitCode !== null) return
  const terminou = new Promise(r => processo.once('exit', r))
  processo.kill('SIGTERM'); await terminou
}
async function chamar(rota, metodo = 'GET', dados) {
  const r = await fetch(base + '/api' + rota, { method: metodo, headers: cabecalhos, body: dados === undefined ? undefined : JSON.stringify(dados) })
  const resposta = await r.json()
  garantir.ok(r.ok, JSON.stringify(resposta))
  return resposta
}
try {
  await iniciar()
  garantir.equal((await fetch(base + '/api/quadro')).status, 401)
  const t = await chamar('/tags', 'POST', { nome: 'Integração' })
  const c = await chamar('/cards', 'POST', { titulo: 'Rotina de integração', descricao: 'Contexto intacto', projeto: 'integracao', tags: [t.id] })
  await chamar(`/cards/${c.id}/comentarios`, 'POST', { texto: 'Agulha exclusiva' })
  garantir.equal((await chamar('/cards?busca=agulha')).length, 1)
  await chamar(`/cards/${c.id}/mover`, 'POST', { coluna: 'Revisão' })
  garantir.equal((await chamar(`/cards?projeto=integracao&tag=${t.id}&autor=codex-integracao&depende=true&dias=1`)).length, 1)
  await chamar(`/tags/${t.id}`, 'PATCH', { nome: 'Renomeada' })
  garantir.equal((await chamar(`/cards/${c.id}`)).tags[0].cor, t.cor)
  await chamar('/projetos/integracao', 'PATCH', { favorito: true, cor: '#123456' })
  garantir.equal((await chamar('/projetos'))[0].colunas.find(c => c.nome === 'Revisão').total, 1)
  await chamar(`/cards/${c.id}/lembrete`, 'PUT', { data: new Date(Date.now() - 3600000).toISOString(), nota: 'Teste' })
  garantir.equal((await chamar('/lembretes')).length, 1)
  await chamar(`/cards/${c.id}/lembrete`, 'POST', { acao: 'feito' })
  garantir.equal((await chamar('/lembretes')).length, 0)
  await chamar(`/cards/${c.id}/repeticao`, 'PUT', { regra: { frequencia: 'diaria' } })
  await chamar(`/cards/${c.id}/mover`, 'POST', { coluna: 'Concluído' })
  garantir.equal((await chamar('/cards')).length, 2)
  await parar(); await iniciar()
  await chamar(`/cards/${c.id}/mover`, 'POST', { coluna: 'A fazer' })
  await chamar(`/cards/${c.id}/mover`, 'POST', { coluna: 'Concluído' })
  garantir.equal((await chamar('/cards')).length, 2)
  await chamar(`/cards/${c.id}/arquivar`, 'POST', {})
  garantir.ok((await chamar('/cards?busca=agulha'))[0].arquivado_em)
  garantir.equal((await chamar('/cards?busca=agulha&arquivados=false')).length, 0)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP8//8/AwMDEwMYAAAkBgMBXaJOiAAAAABJRU5ErkJggg==', 'base64')
  const envio = await fetch(base + '/api/wallpapers', { method: 'POST', headers: { ...cabecalhos, 'Content-Type': 'application/octet-stream' }, body: png })
  garantir.equal(envio.status, 201)
  const w = await envio.json()
  await chamar('/aparencia', 'PUT', { wallpaper: w.id })
  await parar(); await iniciar()
  garantir.equal((await chamar('/aparencia')).wallpaper, w.id)
  const arquivo = await fetch(base + w.url, { headers: cabecalhos })
  garantir.equal(arquivo.headers.get('x-content-type-options'), 'nosniff')
  garantir.deepEqual(Buffer.from(await arquivo.arrayBuffer()), png)
  for (const bytes of [Buffer.from('<svg/>'), Buffer.alloc(8 * 1024 * 1024 + 1)]) {
    const r = await fetch(base + '/api/wallpapers', { method: 'POST', headers: { ...cabecalhos, 'Content-Type': 'image/png' }, body: bytes })
    garantir.ok(!r.ok)
  }
  const cliente = new Client({ name: 'verificacao', version: '1.0' })
  await cliente.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: cabecalhos.Authorization } } }))
  const ferramentas = (await cliente.listTools()).tools.map(t => t.name)
  for (const nome of ['pesquisar_cards', 'filtrar_cards', 'listar_tags', 'criar_tag', 'alterar_tag', 'definir_tags', 'listar_projetos', 'atualizar_projeto', 'lembretes_pendentes', 'definir_lembrete', 'agir_lembrete', 'definir_repeticao', 'agir_repeticao', 'listar_wallpapers', 'obter_wallpaper', 'enviar_wallpaper', 'apagar_wallpaper', 'ver_aparencia', 'escolher_wallpaper']) garantir.ok(ferramentas.includes(nome), nome)
  const resultado = await cliente.callTool({ name: 'pesquisar_cards', arguments: { busca: 'agulha' } })
  garantir.ok(!resultado.isError)
  const tagMcp = await cliente.callTool({ name: 'criar_tag', arguments: { nome: 'MCP', autor: 'astra' } })
  garantir.ok(!tagMcp.isError)
  garantir.ok((await chamar('/tags')).some(t => t.nome === 'MCP'))
  await cliente.close()
  await chamar(`/wallpapers/${w.id}`, 'DELETE')
  garantir.equal((await chamar('/aparencia')).wallpaper, null)
  await chamar(`/tags/${t.id}`, 'DELETE')
  garantir.equal((await chamar(`/cards/${c.id}`)).tags.length, 0)
  console.log('OK: API REST, autenticação, MCP, busca, filtros, tags, projetos, lembretes, repetição após reinício e wallpapers persistentes/rejeições. Produção não foi alterada.')
} finally {
  await parar()
  rmSync(pasta, { recursive: true, force: true })
}
