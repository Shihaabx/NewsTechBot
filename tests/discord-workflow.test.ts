import { describe, expect, it, vi } from 'vitest';
import {
  handleWorkflowButton,
  isWorkflowAuthorized,
} from '../src/discord/commands.js';

function settings(overrides: any = {}) {
  return {
    get: () => ({
      paused: false,
      dryRun: false,
      allowedUserIds: [],
      pollIntervalMinutes: 10,
      maxItemsPerSource: 15,
      maxArticleAgeHours: 72,
      newsMinScore: 58,
      breakingMinScore: 82,
      channels: {
        videoIdeas: '111111111111111',
        usedNews: '222222222222222',
      },
      ...overrides,
    }),
  } as any;
}

function interaction(customId: string) {
  const send = vi.fn(async () => undefined);
  const edit = vi.fn(async () => undefined);
  const editReply = vi.fn(async () => undefined);
  const deferReply = vi.fn(async () => undefined);
  const fetch = vi.fn(async () => ({
    isTextBased: () => true,
    send,
  }));

  return {
    value: {
      customId,
      deferReply,
      editReply,
      client: { channels: { fetch } },
      user: { id: '999999999999999' },
      message: { embeds: [{ title: 'Story' }], edit },
    } as any,
    send,
    edit,
    editReply,
    deferReply,
    fetch,
  };
}

describe('Discord workflow buttons', () => {
  it('denies everyone when the allowlist is empty and only allows listed users otherwise', () => {
    expect(isWorkflowAuthorized('1', settings())).toBe(false);
    expect(isWorkflowAuthorized('999', settings({ allowedUserIds: ['999'] }))).toBe(true);
    expect(isWorkflowAuthorized('123', settings({ allowedUserIds: ['999'] }))).toBe(false);
  });

  it('moves a story to Video Ideas', async () => {
    const mock = interaction('newstech:idea');
    await handleWorkflowButton(mock.value, settings());

    expect(mock.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mock.fetch).toHaveBeenCalledWith('111111111111111');
    expect(mock.send).toHaveBeenCalledOnce();
    expect(mock.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Video Idea') }),
    );
    expect(mock.edit).toHaveBeenCalledOnce();
    expect(mock.editReply).toHaveBeenCalledWith('💡 Saved to video ideas.');
  });

  it('moves a story to Used News', async () => {
    const mock = interaction('newstech:used');
    await handleWorkflowButton(mock.value, settings());

    expect(mock.fetch).toHaveBeenCalledWith('222222222222222');
    expect(mock.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Used') }),
    );
    expect(mock.editReply).toHaveBeenCalledWith('✅ Marked as used.');
  });

  it('shows a useful message when a workflow channel is not configured', async () => {
    const mock = interaction('newstech:idea');
    await handleWorkflowButton(mock.value, settings({ channels: {} }));

    expect(mock.send).not.toHaveBeenCalled();
    expect(mock.editReply).toHaveBeenCalledWith(
      '⚠️ Configure the target channel from the NewsTech Dashboard first.',
    );
  });
});
