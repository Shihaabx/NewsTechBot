# NewsTechBot

**NewsTech** is the private technology-news intelligence bot for the **Juraa Tech Newsroom**.

It watches only sources you approve, removes duplicates/noise, rejects phone-focused content, scores story value, and sends the strongest stories to the right Discord channels.

> The goal is not “more news.” The goal is **fewer, better stories that can become useful Juraa Tech videos**.

## NewsTech v0.2.1

- transparent 0–100 story scoring
- stricter relevance gate so generic corporate posts do not flood Discord
- official-source and freshness signals
- hard phone-topic exclusions
- duplicate detection across publishers
- 72-hour default backlog guard
- feed retry and failure isolation
- branded Discord embeds using Juraa orange `#FF6A00`
- private workflow buttons: **💡 Video Idea** and **✅ Used**
- optional Discord user allowlist
- startup validation for Discord server/channel IDs
- automatic local `.env` loading
- corrupted-state backup/recovery
- runtime `/status` telemetry
- Docker-ready
- no paid AI API required

## Flow

```text
Approved RSS/Atom sources
        ↓
fetch + retry
        ↓
clean + deduplicate
        ↓
phone/topic blocklist
        ↓
technology relevance + value scoring
        ↓
category routing
        ↓
NewsTech Discord card
        ↓
Video Idea / Used workflow
```

## Recommended Discord channels

- `incoming-news` — fallback only
- `breaking-news`
- `ai-news`
- `pc-hardware`
- `windows-software`
- `gaming-tech`
- `cybersecurity`
- `general-tech`
- `video-ideas`
- `used-news`

## Quick start

1. Create a Discord application and bot.
2. Invite it to the private NewsTech server.
3. Copy `.env.example` to `.env`.
4. Add the bot token, guild ID, and channel IDs.
5. Add your Discord user ID to `NEWSTECH_ALLOWED_USER_IDS`.
6. Review `config/sources.yml` and enable only approved feeds.
7. Run:

```bash
npm install
npm run check
npm run dev
```

NewsTech loads `.env` automatically. Invalid IDs, missing required values, or configured channels from the wrong Discord server fail fast at startup with a clear error.

### Docker

```bash
docker compose up -d --build
```

## Source policy

Sources are never auto-discovered. NewsTech reads only entries in `config/sources.yml`.

Example:

```yaml
- id: nvidia-newsroom
  name: NVIDIA Newsroom
  url: https://nvidianews.nvidia.com/releases.xml
  category: pc-hardware
  trust: 100
  enabled: true
  official: true
```

Keep new sources `enabled: false` until their RSS/Atom endpoint is verified.

## How scoring works

A story gains points for source trust, official status, real technology/category signals, high-value announcement terms, genuine breaking/security terms, and freshness.

It loses points for low-value promotional/noisy terms, old content, missing dates, or having no meaningful technology signal.

Default publishing threshold: **58/100**.
Default breaking threshold: **82/100**.

The rules are editable in `config/rules.yml`. This keeps the first version free and auditable instead of hiding decisions behind a paid AI model.

## Reliability rules

- a failed feed does not stop other feeds
- feed fetches retry once
- overlapping poll cycles are blocked
- old backlog is limited
- rejected stories are remembered so they are not rescored forever
- publishable stories are marked seen **only after Discord confirms delivery**
- configured Discord destinations are validated before polling begins
- state writes use atomic rename
- a corrupted state file is backed up before a clean state is created
- duplicate state is pruned after 30 days
- secrets stay in `.env`
- startup configuration is validated before login
- Discord workflow controls can be restricted to your user ID

## Commands

- `/status` — health and last poll statistics
- `/sources` — enabled source list

## Identity

See `BRAND.md`. User-facing bot identity is always **NewsTech** / **Juraa Tech Newsroom**.

## Attribution

MonitoRSS was reviewed as an architectural reference for RSS-to-Discord delivery. The original MIT license is retained in `LICENSE-MonitoRSS.md`; see `NOTICE.md`.

NewsTechBot itself is a simplified, purpose-built implementation rather than a renamed MonitoRSS deployment.
