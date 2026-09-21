import 'dotenv/config';
import path from 'node:path';
import { loadRules, loadSources } from './config/load.js';
import { loadEnv } from './config/env.js';
import { fetchSource } from './feeds/fetcher.js';
import { scoreArticle } from './core/scorer.js';
import { StateStore } from './storage/state.js';
import { DiscordPublisher } from './discord/publisher.js';
import {
  attachInteractionHandler,
  registerCommands,
  type RuntimeStatus,
} from './discord/commands.js';
import { BRAND } from './brand.js';

const env = loadEnv();
const store = new StateStore(path.resolve(env.DATA_PATH));
const publisher = new DiscordPublisher(env);

let enabledSourceNames: string[] = [];
let running = false;

const status: RuntimeStatus = {
  startedAt: new Date().toISOString(),
  enabledSources: 0,
  fetched: 0,
  published: 0,
  filtered: 0,
  failedSources: 0,
};

function isTooOld(date?: Date) {
  if (!date || Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > env.MAX_ARTICLE_AGE_HOURS * 3_600_000;
}

async function poll() {
  if (running) {
    console.warn('[NewsTech] Poll skipped because the previous poll is still running.');
    return;
  }

  running = true;
  const started = Date.now();
  const cycle = { fetched: 0, published: 0, filtered: 0, failedSources: 0 };

  try {
    const [sources, rules] = await Promise.all([
      loadSources(env.SOURCES_PATH),
      loadRules(env.RULES_PATH),
    ]);

    const enabled = sources.filter((source) => source.enabled);
    enabledSourceNames = enabled.map((source) => source.name);
    status.enabledSources = enabled.length;

    for (const source of enabled) {
      try {
        const articles = await fetchSource(source);

        for (const raw of articles.slice(0, env.MAX_ITEMS_PER_SOURCE)) {
          cycle.fetched += 1;
          const article = scoreArticle(raw, rules);

          if (store.has(article.fingerprint)) continue;

          if (isTooOld(article.publishedAt) || article.blocked || article.score < env.NEWS_MIN_SCORE) {
            cycle.filtered += 1;
            await store.mark(article.fingerprint, article.title, article.url);
            continue;
          }

          const published = await publisher.publish(article);
          if (published) {
            cycle.published += 1;
            await store.mark(article.fingerprint, article.title, article.url);
          }
        }
      } catch (error) {
        cycle.failedSources += 1;
        console.error(`[NewsTech:${source.id}] Feed failed`, error);
      }
    }
  } finally {
    status.lastPollAt = new Date().toISOString();
    status.lastPollDurationMs = Date.now() - started;
    status.fetched = cycle.fetched;
    status.published = cycle.published;
    status.filtered = cycle.filtered;
    status.failedSources = cycle.failedSources;
    running = false;

    console.log(
      `[NewsTech] Poll complete: ${cycle.published} published, ${cycle.filtered} filtered, ${cycle.failedSources} source failures.`,
    );
  }
}

async function main() {
  await store.load();
  await publisher.start();

  attachInteractionHandler(
    publisher.client,
    env,
    () => enabledSourceNames,
    () => ({ ...status }),
  );

  const clientId = publisher.client.user?.id;
  if (!clientId) throw new Error('Discord client did not expose an application ID after login.');

  await registerCommands(clientId, env);

  console.log(
    `[${BRAND.name}] ${BRAND.workspace} online. Polling every ${env.POLL_INTERVAL_MINUTES} minutes.`,
  );

  await poll();
  setInterval(() => void poll(), env.POLL_INTERVAL_MINUTES * 60_000);
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[NewsTech] ${signal} received. Shutting down.`);
  await publisher.stop();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((error) => {
  console.error('[NewsTech] Fatal startup error', error);
  process.exit(1);
});
