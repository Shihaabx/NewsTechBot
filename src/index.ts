import path from 'node:path';
import { loadRules, loadSources } from './config/load.js';
import { fetchSource } from './feeds/fetcher.js';
import { scoreArticle } from './core/scorer.js';
import { StateStore } from './storage/state.js';
import { DiscordPublisher } from './discord/publisher.js';
import { attachInteractionHandler, registerCommands } from './discord/commands.js';

const sourcesPath = process.env.SOURCES_PATH ?? './config/sources.yml';
const rulesPath = process.env.RULES_PATH ?? './config/rules.yml';
const dataPath = path.resolve(process.env.DATA_PATH ?? './data/state.json');
const pollMinutes = Math.max(2, Number(process.env.POLL_INTERVAL_MINUTES ?? 10));
const minScore = Number(process.env.NEWS_MIN_SCORE ?? 55);
const breakingMinScore = Number(process.env.BREAKING_MIN_SCORE ?? 82);

const store = new StateStore(dataPath);
const publisher = new DiscordPublisher();
let enabledSourceNames: string[] = [];
let running = false;

async function poll() {
  if (running) return;
  running = true;
  try {
    const [sources, rules] = await Promise.all([loadSources(sourcesPath), loadRules(rulesPath)]);
    const enabled = sources.filter((source) => source.enabled);
    enabledSourceNames = enabled.map((source) => source.name);

    for (const source of enabled) {
      try {
        const articles = await fetchSource(source);
        for (const raw of articles.slice(0, 30)) {
          const article = scoreArticle(raw, rules);
          if (store.has(article.fingerprint)) continue;

          await store.mark(article.fingerprint, article.title, article.url);
          await publisher.publish(article, minScore, breakingMinScore);
        }
      } catch (error) {
        console.error(`[${source.id}] feed failed`, error);
      }
    }
  } finally {
    running = false;
  }
}

async function main() {
  await store.load();
  await publisher.start();
  attachInteractionHandler(publisher.client, () => enabledSourceNames);

  const clientId = publisher.client.user?.id;
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (clientId && guildId && token) {
    await registerCommands(clientId, guildId, token);
  }

  console.log(`NewsTech online. Polling every ${pollMinutes} minutes.`);
  await poll();
  setInterval(() => void poll(), pollMinutes * 60_000);
}

process.on('SIGINT', async () => { await publisher.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await publisher.stop(); process.exit(0); });

main().catch((error) => {
  console.error('Fatal startup error', error);
  process.exit(1);
});
