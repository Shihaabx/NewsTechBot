# NewsTechBot

**NewsTech** is the private technology-news intelligence bot and control room for **Juraa Tech**.

It watches only sources you approve, removes duplicates and low-value noise, blocks phone-focused content, scores each story, routes useful news into Discord, and lets you control the system from a visual dashboard instead of Discord commands.

## NewsTech v0.3.0

### Visual Control Dashboard

Open:

```text
http://127.0.0.1:8787
```

The dashboard includes:

- **Overview** — live health, last-poll metrics, activity log, pause/resume, Poll Now, Discord test
- **Sources** — add, edit, delete, enable/disable, set category, trust score, official-source flag, and test RSS/Atom URLs
- **Filters** — blocked topics, high-value signals, breaking signals, low-value signals, and category keywords
- **Discord** — map every category/workflow channel, validate permissions, refresh bot/server status, and send a branded test card
- **System** — polling interval, per-source item limit, article age, publish/breaking thresholds, Dry Run, workflow user allowlist, and duplicate-history reset
- **Brand** — preview the NewsTech/Juraa identity, upload a PNG/JPEG/WebP logo, reset to the bundled mark, and apply the current name/logo to the Discord bot profile

Discord slash commands are not used for administration. Discord stays focused on the news feed and the **Video Idea / Used** workflow buttons.

## Identity

NewsTech follows the Juraa Tech visual system:

- Orange: `#FF6A00`
- Dark: `#111315`
- Off White: `#F7F7F5`
- Gray: `#9CA3AF`

The repository contains a clean default NewsTech mark. Use the Dashboard **Brand** page to upload the final official Juraa/NewsTech logo and apply it to the Discord bot avatar without editing code.

## News flow

```text
Approved RSS / Atom sources
          ↓
fetch + retry
          ↓
clean + deduplicate
          ↓
phone / topic blocklist
          ↓
technology relevance + value scoring
          ↓
category routing
          ↓
branded Discord story card
          ↓
Video Idea / Used workflow
```

## Security model

Secrets and infrastructure stay outside the web UI:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- dashboard host/port/token

Everything that controls normal NewsTech behavior is editable from the Dashboard.

By default the Dashboard binds to `127.0.0.1`, so it is available only on the same machine. If you expose it beyond localhost, `DASHBOARD_TOKEN` must be at least 16 characters.

The dashboard API also uses security headers, token authentication when configured, constant-time token comparison, strict JSON validation, channel permission validation, and image-file signature checks.

## Quick start

1. Create a Discord application and bot.
2. Invite the bot to your private NewsTech server.
3. Copy `.env.example` to `.env`.
4. Set:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
5. Run:

```bash
npm install
npm run check
npm run dev
```

6. Open:

```text
http://127.0.0.1:8787
```

7. Configure sources, Discord channels, filters, thresholds, workflow access, and branding from the Dashboard.

### Optional local dashboard token

Set:

```text
DASHBOARD_TOKEN=your-long-private-token
```

The browser asks for it once per tab session and keeps it only in `sessionStorage`.

## Docker

Docker exposes the Dashboard only on the host loopback interface:

```text
127.0.0.1:8787
```

Because the process inside the container listens on `0.0.0.0`, set a strong `DASHBOARD_TOKEN` in `.env` before starting:

```bash
docker compose up -d --build
```

The `config/` and `data/` folders are mounted so Dashboard changes survive rebuilds.

## Recommended Discord channels

- `incoming-news` — fallback
- `breaking-news`
- `ai-news`
- `pc-hardware`
- `windows-software`
- `gaming-tech`
- `cybersecurity`
- `general-tech`
- `video-ideas`
- `used-news`

You enter the real Discord channel IDs from the Dashboard.

## Curation

A story gains points for:

- source trust
- official-source status
- technology/category relevance
- high-value announcement signals
- genuine breaking/security signals
- freshness

It loses points for:

- blocked topics
- low-value/promotional signals
- old content
- missing dates
- weak technology relevance

NewsTech remembers rejected and published items for 30 days to avoid repeatedly processing the same stories.

## Reliability

- feed retries
- per-source failure isolation
- overlapping poll protection
- dynamic polling interval
- pause/resume without shutting down Discord or Dashboard
- atomic state/settings/config writes
- corrupted state/settings backup and recovery
- cross-publisher headline deduplication
- article-age backlog protection
- Discord channel/server/permission validation
- publishable articles are marked seen only after successful delivery
- CI validates TypeScript, tests, production build, and Dashboard JavaScript syntax

## Brand files

- `BRAND.md` — locked NewsTech/Juraa identity rules
- `public/assets/newstech-logo.svg` — scalable bundled Dashboard logo
- `public/assets/newstech-logo.png` — bundled Discord-compatible avatar
- Dashboard-uploaded logo — stored locally in `data/brand-logo.json` and ignored by Git

## Attribution

MonitoRSS was reviewed as an architectural reference for RSS-to-Discord delivery. Its MIT license is retained in `LICENSE-MonitoRSS.md`; see `NOTICE.md`.

NewsTechBot is a purpose-built implementation for Juraa Tech rather than a renamed MonitoRSS deployment.
