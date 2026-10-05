// Exemplo: servir a interface já compilada (dist) para outras máquinas sem entregar a chave ao navegador.
// O proxy repassa /api e /mcp para o servidor e é ele quem acrescenta o cabeçalho Authorization.
//
//   cp vite.proxy.example.mjs vite.servidor.config.mjs
//   npm run build
//   BOARD_API_KEY=... BOARD_WEB_HOST=0.0.0.0 npx vite preview -c vite.servidor.config.mjs
//
// Quem alcançar BOARD_WEB_HOST:BOARD_WEB_PORT usa o quadro sem chave: publique só numa rede
// em que você confia (VPN, rede de casa). Para a internet, ponha um proxy com TLS e login na frente.
import { defineConfig } from 'vite'

const alvo = `http://127.0.0.1:${process.env.BOARD_PORT || 8078}`
const chave = process.env.BOARD_API_KEY || ''

export default defineConfig({
  preview: {
    host: process.env.BOARD_WEB_HOST || '127.0.0.1',
    port: Number(process.env.BOARD_WEB_PORT || 5174),
    strictPort: true,
    proxy: {
      '/api': { target: alvo, headers: chave ? { Authorization: `Bearer ${chave}` } : {} },
      // As sessões de IA mandam a própria chave no /mcp; o proxy não a acrescenta.
      '/mcp': { target: alvo },
    },
  },
})
