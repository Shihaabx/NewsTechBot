import { z } from 'zod';

const discordId = z.string().regex(/^\d{15,25}$/, 'must be a Discord snowflake ID');
const optionalDiscordId = z.union([discordId, z.literal('')]).optional().transform((value) => value || undefined);
const boolString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(20),
  DISCORD_GUILD_ID: discordId,
  NEWSTECH_ALLOWED_USER_IDS: z.string().optional().default(''),

  DISCORD_CHANNEL_INCOMING: optionalDiscordId,
  DISCORD_CHANNEL_BREAKING: optionalDiscordId,
  DISCORD_CHANNEL_AI: optionalDiscordId,
  DISCORD_CHANNEL_PC_HARDWARE: optionalDiscordId,
  DISCORD_CHANNEL_WINDOWS_SOFTWARE: optionalDiscordId,
  DISCORD_CHANNEL_GAMING_TECH: optionalDiscordId,
  DISCORD_CHANNEL_CYBERSECURITY: optionalDiscordId,
  DISCORD_CHANNEL_GENERAL_TECH: optionalDiscordId,
  DISCORD_CHANNEL_VIDEO_IDEAS: optionalDiscordId,
  DISCORD_CHANNEL_USED_NEWS: optionalDiscordId,

  POLL_INTERVAL_MINUTES: z.coerce.number().int().min(2).max(1440).default(10),
  MAX_ITEMS_PER_SOURCE: z.coerce.number().int().min(1).max(100).default(15),
  MAX_ARTICLE_AGE_HOURS: z.coerce.number().min(1).max(720).default(72),
  NEWS_MIN_SCORE: z.coerce.number().int().min(0).max(100).default(58),
  BREAKING_MIN_SCORE: z.coerce.number().int().min(0).max(100).default(82),

  DATA_PATH: z.string().min(1).default('./data/state.json'),
  SETTINGS_PATH: z.string().min(1).default('./data/settings.json'),
  BRAND_LOGO_PATH: z.string().min(1).default('./data/brand-logo.json'),
  SOURCES_PATH: z.string().min(1).default('./config/sources.yml'),
  RULES_PATH: z.string().min(1).default('./config/rules.yml'),
  DRY_RUN: boolString.default('false'),

  DASHBOARD_ENABLED: boolString.default('true'),
  DASHBOARD_HOST: z.string().min(1).default('127.0.0.1'),
  DASHBOARD_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DASHBOARD_TOKEN: z.string().optional().default(''),
}).superRefine((env, ctx) => {
  if (env.BREAKING_MIN_SCORE < env.NEWS_MIN_SCORE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BREAKING_MIN_SCORE'],
      message: 'must be greater than or equal to NEWS_MIN_SCORE',
    });
  }

  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(env.DASHBOARD_HOST);
  if (env.DASHBOARD_ENABLED && !loopback && env.DASHBOARD_TOKEN.length < 16) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DASHBOARD_TOKEN'],
      message: 'must be at least 16 characters when dashboard is exposed beyond localhost',
    });
  }
});

export type AppEnv = z.infer<typeof envSchema> & { allowedUserIds: string[] };

export function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid NewsTech configuration:\n${details}`);
  }

  const allowedUserIds = parsed.data.NEWSTECH_ALLOWED_USER_IDS
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const id of allowedUserIds) {
    if (!/^\d{15,25}$/.test(id)) {
      throw new Error(`Invalid Discord user ID in NEWSTECH_ALLOWED_USER_IDS: ${id}`);
    }
  }

  return { ...parsed.data, allowedUserIds };
}
