# Changelog

Notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-10-05

### Added

- **English and Portuguese interface.** The language is chosen in Settings → Customize and kept in the browser; the first visit follows the browser language. Dates and times follow the chosen language. Default board and column names, history actions and reminder states are translated for display only: the API and the database keep the Portuguese names.

- **Automatic backups.** The server copies its own database (consistent, taken while running) and the wallpapers once a day, verifies the copy and keeps the 14 most recent. Configure with `BOARD_BACKUP_DIR`, `BOARD_BACKUP_HORAS` and `BOARD_BACKUP_MANTER`. The settings menu shows the last backup and has "Back up now"; REST `GET`/`POST /api/backups`, MCP `ver_backups` and `fazer_backup`, CLI `backups` and `backup`.
- Codex instructions for connecting over MCP.

### Changed

- `npm test` in `server/` runs only the tests in `src`. It used to run the compiled copies in `dist` as well, counting every test twice.

### Fixed

- Reminder times on cards were always shown in the São Paulo time zone; they now use the browser time zone, like the rest of the interface.

## [0.2.0] - 2026-10-05

### Added

- **Several boards.** Create, rename and delete boards (only empty ones, never the last one) and switch between them from the footer. REST: `/quadros`; MCP: `listar_quadros`, `criar_quadro`, and an optional `quadro` on `ver_quadro`, `criar_card` and `filtrar_cards`.
- **Search** across titles, descriptions, comments, projects and tags, including archived cards (Ctrl+K).
- **Tags** with colours, and **combinable filters** (project, tag, author, column, in review, with reminder, recurring, period) kept in the URL.
- **Project list** with a colour, counts per column, last activity, pinning and hiding.
- **Reminders** per card, with done and snooze actions, and a query for agents (`lembretes_pendentes`).
- **Recurring tasks** (daily, weekly, monthly). Completing a card creates the next occurrence exactly once.
- **Archive and undo.** Cards are archived instead of deleted; Ctrl+Z undoes the last action. Writes carry a revision number so two sessions do not overwrite each other.
- **Three themes** (dark, light, glass) and **wallpapers** stored on the server, validated by content.
- **CLI** (`cli/agent-board.mjs`) for agents without MCP, plus an instruction file for Claude Code.
- `SECURITY.md`, `CONTRIBUTING.md`, issue and pull request templates. English README.

### Changed

- **The header is a single row.** Search, filters, projects and reminders open list panels instead of taking space above the board.
- Moving a card by column name now looks for the column in the card's own board.
- Authors without a preset colour get a stable colour derived from their name.
- `better-sqlite3` 12, so the server runs on Node 20 and 22. CI tests both.
- The Docker image runs as a non-root user and `docker compose` publishes ports on localhost only.

### Security

- **CORS is off by default.** Version 0.1 answered any origin while running without a key, so a website open in the browser could read and change a local board. Now, without a key, the server refuses unknown `Host` headers and requests from other origins. Allowed origins are listed in `BOARD_CORS_ORIGENS`.
- The server refuses to start on a non-local interface without `BOARD_API_KEY` (override: `BOARD_PERMITIR_ABERTO=1`).
- The API key is compared in constant time.
- Size limits on titles (300), descriptions and comments (50,000), project names (80) and author names (60).

### Upgrade notes

- The database migrates itself on start; back up `board.db` first as a precaution.
- If the interface was reaching the API from a different origin, set `BOARD_CORS_ORIGENS`.
- If the server was listening on `0.0.0.0` without a key, set `BOARD_API_KEY` or `BOARD_PERMITIR_ABERTO=1`.

## [0.1.0] - 2026-09-14

First public version: one board, columns, cards, comments, history with authorship, REST API and eight MCP tools.

[0.3.0]: https://github.com/Slayer1Dev/agent-board/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Slayer1Dev/agent-board/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Slayer1Dev/agent-board/releases/tag/v0.1.0
