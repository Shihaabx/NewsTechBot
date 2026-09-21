import { describe, expect, it } from 'vitest';
import { runtimeSettingsSchema } from '../src/control/settings.js';

const valid = {
  paused: false,
  dryRun: false,
  allowedUserIds: ['123456789012345'],
  pollIntervalMinutes: 10,
  maxItemsPerSource: 15,
  maxArticleAgeHours: 72,
  newsMinScore: 58,
  breakingMinScore: 82,
  channels: {
    incoming: '123456789012345',
  },
};

describe('runtimeSettingsSchema', () => {
  it('accepts valid dashboard settings', () => {
    expect(runtimeSettingsSchema.parse(valid).newsMinScore).toBe(58);
  });

  it('rejects a breaking threshold lower than the publish threshold', () => {
    expect(() => runtimeSettingsSchema.parse({
      ...valid,
      newsMinScore: 80,
      breakingMinScore: 70,
    })).toThrow();
  });

  it('rejects invalid Discord user IDs', () => {
    expect(() => runtimeSettingsSchema.parse({
      ...valid,
      allowedUserIds: ['not-a-discord-id'],
    })).toThrow();
  });

  it('accepts empty optional channels', () => {
    expect(runtimeSettingsSchema.parse({
      ...valid,
      channels: { incoming: '' },
    }).channels.incoming).toBeUndefined();
  });
});
