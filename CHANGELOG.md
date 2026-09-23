# Changelog

## 0.4.0

- added persistent News Inbox with scored previews, filter reasons, search, and status filters
- added manual editorial approval/rejection actions and an authenticated Dashboard API
- enabled manual review by default, with opt-in auto-publishing
- ensured Dry Run previews cannot be published to Discord
- added an inbox publication lock to avoid simultaneous automatic/manual double posts
- added inbox persistence/recovery, dashboard API tests, and real-browser review workflow
- locked Discord workflow buttons when the allowlist is empty


## 0.3.0

- added a full visual NewsTech Control Dashboard
- replaced Discord slash-command administration with Dashboard UI/UX
- added Overview health metrics, activity events, Poll Now, pause/resume, and Discord test
- added source CRUD, enable/disable toggles, trust/category/official controls, and feed testing
- added complete filter/rule editing
- added Discord channel mapping and permission validation
- added runtime control for polling, age limits, score thresholds, Dry Run, and workflow user allowlist
- added duplicate-history maintenance controls
- added Brand page with logo upload/reset and Discord bot identity application
- added bundled NewsTech SVG + PNG identity assets
- added dashboard API authentication and security headers
- added constant-time dashboard token comparison
- added image signature validation for uploaded logos
- added persisted runtime settings separate from secrets
- added dashboard JavaScript syntax validation to CI
- added runtime-settings tests

## 0.2.1

- load local `.env` automatically
- validate all configured Discord channels at startup
- reject channel IDs that point to another Discord server
- make workflow button states final and consistent
- defer button interactions before network work to avoid Discord interaction timeouts
- back up and recover from a corrupted local state file

## 0.2.0

- centralized NewsTech/Juraa Tech brand identity
- applied Juraa orange to Discord embeds
- made official-source scoring stricter so generic corporate posts do not flood the newsroom
- added technology relevance signals to scoring
- strengthened phone-topic exclusions
- fixed NVIDIA official RSS endpoint
- changed deduplication to catch the same headline across multiple publishers
- added feed retry and cleaner RSS content parsing
- added configurable article-age and per-source backlog limits
- fixed delivery reliability: a story is only marked seen after successful Discord publication
- added validated environment configuration with clear startup errors
- added optional private user allowlist for workflow controls
- added richer runtime telemetry
- expanded tests and CI build validation
