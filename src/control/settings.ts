import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { AppEnv } from '../config/env.js';

const optionalSnowflake = z.union([
  z.string().regex(/^\d{15,25}$/, 'must be a Discord channel ID'),
  z.literal(''),
]).transform((value) => value || undefined);

export const runtimeSettingsSchema = z.object({
  paused: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  reviewBeforePublish: z.boolean().default(true),
  allowedUserIds: z.array(
    z.string().regex(/^\d{15,25}$/, 'must be a Discord user ID'),
  ).max(50).default([]),
  pollIntervalMinutes: z.coerce.number().int().min(2).max(1440),
  maxItemsPerSource: z.coerce.number().int().min(1).max(100),
  maxArticleAgeHours: z.coerce.number().min(1).max(720),
  newsMinScore: z.coerce.number().int().min(0).max(100),
  breakingMinScore: z.coerce.number().int().min(0).max(100),
  channels: z.object({
    incoming: optionalSnowflake.optional(),
    breaking: optionalSnowflake.optional(),
    ai: optionalSnowflake.optional(),
    pcHardware: optionalSnowflake.optional(),
    windowsSoftware: optionalSnowflake.optional(),
    gamingTech: optionalSnowflake.optional(),
    cybersecurity: optionalSnowflake.optional(),
    generalTech: optionalSnowflake.optional(),
    videoIdeas: optionalSnowflake.optional(),
    usedNews: optionalSnowflake.optional(),
  }),
}).superRefine((settings, ctx) => {
  if (settings.breakingMinScore < settings.newsMinScore) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['breakingMinScore'],
      message: 'must be greater than or equal to newsMinScore',
    });
  }
});

export type RuntimeSettings = z.infer<typeof runtimeSettingsSchema>;

export function defaultsFromEnv(env: AppEnv): RuntimeSettings {
  return runtimeSettingsSchema.parse({
    paused: false,
    dryRun: env.DRY_RUN,
    reviewBeforePublish: true,
    allowedUserIds: env.allowedUserIds,
    pollIntervalMinutes: env.POLL_INTERVAL_MINUTES,
    maxItemsPerSource: env.MAX_ITEMS_PER_SOURCE,
    maxArticleAgeHours: env.MAX_ARTICLE_AGE_HOURS,
    newsMinScore: env.NEWS_MIN_SCORE,
    breakingMinScore: env.BREAKING_MIN_SCORE,
    channels: {
      incoming: env.DISCORD_CHANNEL_INCOMING,
      breaking: env.DISCORD_CHANNEL_BREAKING,
      ai: env.DISCORD_CHANNEL_AI,
      pcHardware: env.DISCORD_CHANNEL_PC_HARDWARE,
      windowsSoftware: env.DISCORD_CHANNEL_WINDOWS_SOFTWARE,
      gamingTech: env.DISCORD_CHANNEL_GAMING_TECH,
      cybersecurity: env.DISCORD_CHANNEL_CYBERSECURITY,
      generalTech: env.DISCORD_CHANNEL_GENERAL_TECH,
      videoIdeas: env.DISCORD_CHANNEL_VIDEO_IDEAS,
      usedNews: env.DISCORD_CHANNEL_USED_NEWS,
    },
  });
}

export class SettingsStore {
  private settings: RuntimeSettings;

  constructor(
    private readonly filePath: string,
    private readonly defaults: RuntimeSettings,
  ) {
    this.settings = structuredClone(defaults);
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.settings = runtimeSettingsSchema.parse(JSON.parse(raw));
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        this.settings = structuredClone(this.defaults);
        await this.save();
        return;
      }

      const backup = `${this.filePath}.corrupt-${Date.now()}.json`;
      console.error(`[NewsTech] Invalid runtime settings; backing up to ${backup}.`, error);
      try {
        await fs.rename(this.filePath, backup);
      } catch {}
      this.settings = structuredClone(this.defaults);
      await this.save();
    }
  }

  get(): RuntimeSettings {
    return structuredClone(this.settings);
  }

  async replace(input: unknown): Promise<RuntimeSettings> {
    const next = runtimeSettingsSchema.parse(input);
    this.settings = next;
    await this.save();
    return this.get();
  }

  async patch(input: Partial<RuntimeSettings>): Promise<RuntimeSettings> {
    return this.replace({
      ...this.settings,
      ...input,
      channels: {
        ...this.settings.channels,
        ...(input.channels ?? {}),
      },
    });
  }

  private async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(this.settings, null, 2), 'utf8');
    await fs.rename(temp, this.filePath);
  }
}
