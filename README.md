# NewsTechBot

A lightweight Discord bot for **Juraa Tech** that collects technology news only from sources you approve, removes noise and duplicates, scores article value, and routes useful stories into the correct Discord channels.

## What changed from the MonitoRSS idea?

MonitoRSS was reviewed as the starting point. It is a broad, multi-service RSS platform. NewsTechBot intentionally keeps the useful RSS-to-Discord concept but removes the infrastructure that is unnecessary for one private newsroom: no MongoDB, PostgreSQL, Redis, RabbitMQ, public dashboard, billing, or multi-tenant account system.

The result is one Node.js service that is easier and cheaper to run and modify.

## Core behavior

1. Read only enabled feeds from `config/sources.yml`.
2. Fetch new RSS/Atom articles.
3. Canonicalize links and deduplicate articles for 30 days.
4. Block unwanted topics (phones are blocked by default for Juraa Tech).
5. Classify into AI, PC hardware, Windows/software, gaming tech, cybersecurity, or general tech.
6. Score each story from 0–100 using source trust, official-source status, freshness, high-value terms, breaking terms, and low-value penalties.
7. Publish only articles above `NEWS_MIN_SCORE`.
8. Route truly urgent/high-value stories to `#breaking-news` when they also exceed `BREAKING_MIN_SCORE`.

No paid AI API is required for this version.

## Discord channels

- `incoming-news` (fallback)
- `breaking-news`
- `ai-news`
- `pc-hardware`
- `windows-software`
- `gaming-tech`
- `cybersecurity`
- `general-tech`
- `video-ideas` — receives stories saved with the **💡 Video Idea** button
- `used-news` — receives stories marked with the **✅ Used** button

## Quick start

```bash
cp .env.example .env
npm install
npm run check
npm run dev
```

Before starting, create a Discord application/bot, invite it to your private server, add its token and channel IDs to `.env`, then enable only the sources you want in `config/sources.yml`.

### Docker

```bash
cp .env.example .env
docker compose up -d --build
```

The `data/` volume stores deduplication state. The `config/` folder is mounted read-only so you can edit sources and rules without rebuilding the image.

## Selecting sources

Every source has:

```yaml
- id: nvidia-newsroom
  name: NVIDIA Newsroom
  url: https://example.com/feed.xml
  category: pc-hardware
  trust: 100
  enabled: true
  official: true
```

`trust` is 0–100. Official company feeds should normally be highest. Third-party publications can use lower trust values based on how much you want their stories to influence scoring.

## Curation rules

Edit `config/rules.yml` to change blocked topics, high-value terms, breaking-news terms, low-value/noisy terms, and category keywords. This keeps filtering transparent and testable.

## Commands

- `/status` — bot health
- `/sources` — enabled sources

Every published story also includes **💡 Video Idea** and **✅ Used** buttons for the Juraa content workflow.

## Security / reliability

- secrets live only in `.env` (ignored by git)
- one poll runs at a time to prevent overlap
- failed feeds do not stop other sources
- state writes use a temporary file + atomic rename
- duplicate state is pruned after 30 days
- feed requests time out after 15 seconds
- CI runs TypeScript checks and tests

## Attribution

See `NOTICE.md` and `LICENSE-MonitoRSS.md` for the MonitoRSS attribution/license retained from the reviewed source project.
