# Security policy · Política de segurança

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting instead: on this repository, go to **Security → Report a vulnerability**. Describe what you found, how to reproduce it and which version or commit you tested. You should get a first answer within a week. This is a personal project maintained in spare time, so fixes may take longer than that, but reports are read and taken seriously.

Only the latest release receives fixes.

## What the project protects, and what it does not

agent-board is a personal tool. Knowing its limits helps you tell a vulnerability from a documented design choice.

**Protected:**

- Without `BOARD_API_KEY`, the server only answers requests made to its own localhost address. Unknown `Host` headers (DNS rebinding) and requests from other browser origins are refused.
- The server refuses to start on a non-local interface without a key, unless `BOARD_PERMITIR_ABERTO=1` is set.
- With a key, every REST and MCP request must carry it; the comparison is constant-time.
- All SQL is parameterised. The interface never injects HTML from card content.
- Uploaded wallpapers are validated by content (PNG, JPG or WebP only, no SVG), limited to 8 MB, stored under a server-generated name and served with `X-Content-Type-Options: nosniff`.

**Not protected, by design:**

- **There are no user accounts.** Anyone who can reach the API with the key (or without one, on localhost) can read and change everything.
- **The `autor` field is declared by the caller and is not verified.** It is a history, not an audit trail against a malicious actor.
- **The key is a single shared secret.** There are no scopes and no rotation mechanism other than changing the variable and restarting.
- **No rate limiting.** Put the server behind a reverse proxy if you expose it to an untrusted network. Exposing it directly to the internet is not a supported setup.
- **Traffic is plain HTTP.** Use a VPN (WireGuard, Tailscale) or a TLS-terminating proxy between machines.

Reports about anything in the second list are welcome as feature requests in a normal issue.

---

## Em português

**Não abra issue pública** para problema de segurança. Use o relato privado do GitHub: neste repositório, **Security → Report a vulnerability**. Descreva o que encontrou, como reproduzir e em qual versão ou commit testou. A primeira resposta deve vir em até uma semana. É um projeto pessoal, mantido nas horas vagas; a correção pode demorar mais, mas todo relato é lido e levado a sério.

Só a versão mais recente recebe correções.

O que o projeto protege e o que deixa de fora de propósito está descrito na seção em inglês acima. Em resumo: sem chave, o servidor só responde em localhost e recusa chamadas vindas de outros sites; com chave, toda requisição precisa dela. Não há contas de usuário, o `autor` é declarado e não verificado, não há limite de requisições e o tráfego é HTTP puro. Expor o servidor direto à internet não é um uso suportado.
