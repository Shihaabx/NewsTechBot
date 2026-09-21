# Changelog

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
- added richer /status telemetry
- disables a workflow button after it is used to reduce accidental duplicate actions
- expanded tests and CI build validation
