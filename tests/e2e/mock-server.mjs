import express from 'express';
import path from 'node:path';

const app = express();
const port = 4173;
const token = 'test-dashboard-token-1234';
const publicDir = path.resolve('public');

app.use(express.json({ limit: '3mb' }));

let sources = [
  {
    id: 'nvidia-newsroom',
    name: 'NVIDIA Newsroom',
    url: 'https://nvidianews.nvidia.com/releases.xml',
    category: 'pc-hardware',
    trust: 100,
    enabled: true,
    official: true,
  },
  {
    id: 'openai-news',
    name: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
    category: 'ai',
    trust: 100,
    enabled: false,
    official: true,
  },
];

let rules = {
  blocked_topics: ['iphone', 'phone'],
  high_value_terms: ['release', 'rtx'],
  breaking_terms: ['zero-day'],
  low_value_terms: ['giveaway'],
  categories: {
    ai: { terms: ['openai', 'ai model'] },
    'pc-hardware': { terms: ['nvidia', 'rtx', 'gpu'] },
    'windows-software': { terms: ['windows', 'microsoft'] },
    'gaming-tech': { terms: ['steam', 'directx'] },
    cybersecurity: { terms: ['cve', 'zero-day'] },
    'general-tech': { terms: ['technology'] },
  },
};

let settings = {
  paused: false,
  dryRun: false,
  allowedUserIds: ['111111111111111'],
  pollIntervalMinutes: 10,
  maxItemsPerSource: 15,
  maxArticleAgeHours: 72,
  newsMinScore: 58,
  breakingMinScore: 82,
  channels: {
    incoming: '222222222222222',
    breaking: undefined,
    ai: undefined,
    pcHardware: undefined,
    windowsSoftware: undefined,
    gamingTech: undefined,
    cybersecurity: undefined,
    generalTech: undefined,
    videoIdeas: undefined,
    usedNews: undefined,
  },
};

let status = {
  startedAt: new Date().toISOString(),
  lastPollAt: undefined,
  lastPollDurationMs: undefined,
  enabledSources: 1,
  fetched: 0,
  published: 0,
  filtered: 0,
  duplicates: 0,
  failedSources: 0,
  running: false,
};

let seenCount = 12;
let customLogo = null;
let events = [
  { id: 1, at: new Date().toISOString(), level: 'success', message: 'Mock Discord connected', detail: 'NewsTech#0001' },
];

function channelChecks() {
  return Object.entries(settings.channels).map(([key, id]) => ({
    key,
    id,
    configured: Boolean(id),
    valid: true,
    name: id ? 'mock-' + key : undefined,
  }));
}

function discord() {
  return {
    bot: { id: '999999999999999', username: 'NewsTech', avatarUrl: '/assets/newstech-logo.svg' },
    guild: { id: '888888888888888', name: 'Juraa Newsroom', iconUrl: null },
    channels: channelChecks(),
  };
}

function addEvent(level, message, detail) {
  events.unshift({ id: Date.now(), at: new Date().toISOString(), level, message, detail });
  events = events.slice(0, 80);
}

app.get('/health', (_req, res) => res.json({ ok: true, product: 'NewsTech' }));

app.get('/api/auth', (_req, res) => res.json({ required: true }));

app.get('/api/brand/logo', (_req, res) => {
  if (customLogo) {
    res.type(customLogo.mime).send(Buffer.from(customLogo.base64, 'base64'));
    return;
  }
  res.sendFile(path.join(publicDir, 'assets', 'newstech-logo.svg'));
});

app.use('/api', (req, res, next) => {
  const supplied = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (supplied !== token) {
    res.status(401).json({ error: 'Dashboard authentication required.' });
    return;
  }
  next();
});

app.get('/api/bootstrap', (_req, res) => {
  res.json({
    brand: {
      name: 'NewsTech',
      workspace: 'Juraa Tech Newsroom',
      signature: 'JURAA TECH • NEWS INTELLIGENCE',
      colors: { primary: 16738816, dark: 1118997, light: 16252917, muted: 10265519 },
    },
    status,
    settings,
    sources,
    rules,
    discord: discord(),
    seenCount,
    events,
    customLogo: Boolean(customLogo),
    authRequired: true,
  });
});

app.get('/api/status', (_req, res) => {
  res.json({ status, settings, seenCount, events });
});

app.get('/api/discord', (_req, res) => res.json(discord()));

app.post('/api/discord/test', (_req, res) => {
  addEvent('success', 'Discord test message sent');
  res.json({ ok: true });
});

app.get('/api/sources', (_req, res) => res.json(sources));

app.post('/api/sources/test', (req, res) => {
  if (!req.body?.url) return res.status(400).json({ error: 'URL required' });
  res.json({
    ok: true,
    count: 6,
    latest: { title: 'Mock technology launch', url: req.body.url, publishedAt: new Date().toISOString() },
  });
});

app.post('/api/sources', (req, res) => {
  const idBase = String(req.body.name || 'source').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let id = idBase || 'source';
  let suffix = 2;
  while (sources.some((item) => item.id === id)) id = idBase + '-' + suffix++;
  const source = { ...req.body, id };
  sources = [...sources, source];
  status.enabledSources = sources.filter((item) => item.enabled).length;
  addEvent('success', 'Source added: ' + source.name);
  res.status(201).json(sources);
});

app.put('/api/sources/:id', (req, res) => {
  const index = sources.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Source not found.' });
  sources[index] = { ...sources[index], ...req.body, id: req.params.id };
  status.enabledSources = sources.filter((item) => item.enabled).length;
  addEvent('success', 'Source updated: ' + sources[index].name);
  res.json(sources);
});

app.delete('/api/sources/:id', (req, res) => {
  const found = sources.find((item) => item.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Source not found.' });
  sources = sources.filter((item) => item.id !== req.params.id);
  status.enabledSources = sources.filter((item) => item.enabled).length;
  addEvent('warning', 'Source deleted: ' + found.name);
  res.json(sources);
});

app.get('/api/rules', (_req, res) => res.json(rules));
app.put('/api/rules', (req, res) => {
  rules = req.body;
  addEvent('success', 'News filters updated');
  res.json(rules);
});

app.put('/api/settings', (req, res) => {
  if (Number(req.body.breakingMinScore) < Number(req.body.newsMinScore)) {
    return res.status(400).json({ error: 'breakingMinScore: must be greater than or equal to newsMinScore' });
  }
  settings = req.body;
  addEvent('success', 'Runtime settings updated');
  res.json(settings);
});

app.post('/api/actions/poll', (_req, res) => {
  const startedAt = new Date();
  status = {
    ...status,
    running: false,
    lastPollAt: new Date().toISOString(),
    lastPollDurationMs: 320,
    fetched: 6,
    published: 2,
    filtered: 3,
    duplicates: 1,
    failedSources: 0,
  };
  addEvent('success', 'Poll finished: 2 published', '6 fetched • 3 filtered • 1 duplicates');
  res.json({
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 320,
    fetched: 6,
    published: 2,
    filtered: 3,
    duplicates: 1,
    failedSources: 0,
  });
});

app.post('/api/actions/pause', (_req, res) => {
  settings = { ...settings, paused: true };
  addEvent('warning', 'News collection paused from dashboard');
  res.json(settings);
});

app.post('/api/actions/resume', (_req, res) => {
  settings = { ...settings, paused: false };
  addEvent('success', 'News collection resumed from dashboard');
  res.json(settings);
});

app.post('/api/actions/clear-history', (_req, res) => {
  seenCount = 0;
  addEvent('warning', 'Duplicate history cleared');
  res.json({ ok: true, seenCount });
});

app.post('/api/brand/logo', (req, res) => {
  customLogo = { mime: req.body.mime, base64: req.body.base64 };
  addEvent('success', 'Custom NewsTech logo uploaded');
  res.json({ ok: true, bytes: Buffer.from(req.body.base64, 'base64').length });
});

app.delete('/api/brand/logo', (_req, res) => {
  customLogo = null;
  addEvent('warning', 'Custom logo reset to NewsTech default');
  res.json({ ok: true });
});

app.post('/api/brand/apply', (_req, res) => {
  addEvent('success', 'NewsTech name and logo applied to Discord bot');
  res.json({ username: 'NewsTech', avatarUrl: '/assets/newstech-logo.svg' });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown NewsTech API endpoint.' }));
app.use(express.static(publicDir, { index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(port, '127.0.0.1', () => {
  console.log('NewsTech E2E mock server on http://127.0.0.1:' + port);
});
