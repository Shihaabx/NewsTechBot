import { z } from 'zod';

const discordId = z.string().regex(/^\d{15,25}$/, 'must be a Discord snowflake ID');
const optionalDiscordId = z.union([discordId, z.literal('')]).optional().transform((value) => value || undefined);

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
  SOURCES_PATH: z.string().min(1).default('./config/sources.yml'),
  RULES_PATH: z.string().min(1).default('./config/rules.yml'),
  DRY_RUN: z.enum(['true','false']).default('false').transform((value) => value === 'true'),
}).superRefine((env, ctx) => {
  if (env.BREAKING_MIN_SCORE < env.NEWS_MIN_SCORE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BREAKING_MIN_SCORE'],
      message: 'must be greater than or equal to NEWS_MIN_SCORE',
    });
  }

  const categoryChannels = [
    env.DISCORD_CHANNEL_INCOMING,
    env.DISCORD_CHANNEL_AI,
    env.DISCORD_CHANNEL_PC_HARDWARE,
    env.DISCORD_CHANNEL_WINDOWS_SOFTWARE,
    env.DISCORD_CHANNEL_GAMING_TECH,
    env.DISCORD_CHANNEL_CYBERSECURITY,
    env.DISCORD_CHANNEL_GENERAL_TECH,
  ];

  if (!env.DRY_RUN && categoryChannels.every((value) => !value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DISCORD_CHANNEL_INCOMING'],
      message: 'configure at least one news channel unless DRY_RUN=true',
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
