import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import type { ScoredArticle } from '../core/types.js';
import type { AppEnv } from '../config/env.js';
import type { RuntimeSettings } from '../control/settings.js';
import { SettingsStore } from '../control/settings.js';
import { BRAND, getCategoryMeta, getPriorityLabel } from '../brand.js';
import { channelIdForCategory } from './channels.js';

export type WorkflowState = 'none' | 'idea' | 'used';

export function workflowButtons(state: WorkflowState = 'none') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('newstech:idea')
      .setLabel('Video Idea')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state === 'idea' || state === 'used'),
    new ButtonBuilder()
      .setCustomId('newstech:used')
      .setLabel('Used')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state === 'used'),
  );
}

export interface ChannelCheck {
  key: string;
  id?: string;
  configured: boolean;
  valid: boolean;
  name?: string;
  error?: string;
}

export class DiscordPublisher {
  readonly client = new Client({ intents: [GatewayIntentBits.Guilds] });

  constructor(
    private readonly env: AppEnv,
    private readonly settingsStore: SettingsStore,
  ) {}

  async start() {
    await this.client.login(this.env.DISCORD_BOT_TOKEN);
    await this.validateSettingsChannels(this.settingsStore.get());
  }

  async stop() {
    this.client.destroy();
  }

  async channelChecks(settings = this.settingsStore.get()): Promise<ChannelCheck[]> {
    const guild = await this.client.guilds.fetch(this.env.DISCORD_GUILD_ID);
    const entries = Object.entries(settings.channels);

    return Promise.all(entries.map(async ([key, id]) => {
      if (!id) return { key, configured: false, valid: true };

      try {
        const channel = await this.client.channels.fetch(id);
        if (!channel || !channel.isTextBased() || !('send' in channel)) {
          return { key, id, configured: true, valid: false, error: 'Not a writable text channel' };
        }

        if ('guildId' in channel && channel.guildId !== guild.id) {
          return { key, id, configured: true, valid: false, error: 'Channel belongs to another server' };
        }

        const me = guild.members.me ?? await guild.members.fetchMe();
        const permissions = 'permissionsFor' in channel
          ? channel.permissionsFor(me)
          : null;
        const valid = Boolean(
          permissions?.has(PermissionFlagsBits.ViewChannel)
          && permissions.has(PermissionFlagsBits.SendMessages)
          && permissions.has(PermissionFlagsBits.EmbedLinks),
        );

        return {
          key,
          id,
          configured: true,
          valid,
          name: 'name' in channel ? String(channel.name) : undefined,
          error: valid ? undefined : 'Missing View Channel / Send Messages / Embed Links permission',
        };
      } catch (error: any) {
        return { key, id, configured: true, valid: false, error: error?.message ?? 'Channel lookup failed' };
      }
    }));
  }

  async validateSettingsChannels(settings: RuntimeSettings) {
    const checks = await this.channelChecks(settings);
    const invalid = checks.filter((item) => item.configured && !item.valid);
    if (invalid.length) {
      throw new Error(
        `Invalid Discord channel configuration: ${invalid.map((item) => `${item.key}: ${item.error}`).join('; ')}`,
      );
    }
    return checks;
  }

  async inspect() {
    const guild = await this.client.guilds.fetch(this.env.DISCORD_GUILD_ID);
    return {
      bot: {
        id: this.client.user?.id,
        username: this.client.user?.username,
        avatarUrl: this.client.user?.displayAvatarURL({ size: 256 }),
      },
      guild: {
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ size: 128 }),
      },
      channels: await this.channelChecks(),
    };
  }

  async applyIdentity(logo?: Buffer) {
    if (!this.client.user) throw new Error('Discord bot user is unavailable.');
    if (this.client.user.username !== BRAND.name) {
      await this.client.user.setUsername(BRAND.name);
    }
    if (logo) await this.client.user.setAvatar(logo);
    return {
      username: this.client.user.username,
      avatarUrl: this.client.user.displayAvatarURL({ size: 256 }),
    };
  }

  async sendTest(channelId?: string) {
    const settings = this.settingsStore.get();
    const id = channelId
      || settings.channels.incoming
      || settings.channels.generalTech
      || Object.values(settings.channels).find(Boolean);

    if (!id) throw new Error('Configure at least one Discord channel first.');
    const channel = await this.getTextChannel(id);
    if (!channel) throw new Error('Selected Discord channel is unavailable.');

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setAuthor({ name: `${BRAND.name} • ${BRAND.workspace}` })
          .setTitle('NewsTech connection test')
          .setDescription('Dashboard control, Discord permissions, and branded embeds are working.')
          .addFields(
            { name: 'STATUS', value: '✅ Connected', inline: true },
            { name: 'CONTROL', value: 'Dashboard', inline: true },
          )
          .setFooter({ text: BRAND.signature })
          .setTimestamp(),
      ],
      allowedMentions: { parse: [] },
    });
  }

  private async getTextChannel(id?: string): Promise<TextChannel | null> {
    if (!id) return null;
    const channel = await this.client.channels.fetch(id);
    return channel?.isTextBased() && 'send' in channel ? channel as TextChannel : null;
  }

  async publish(article: ScoredArticle) {
    const settings = this.settingsStore.get();
    if (article.blocked || article.score < settings.newsMinScore) return false;

    const isBreaking = article.breaking && article.score >= settings.breakingMinScore;
    const destination = isBreaking
      ? settings.channels.breaking
        || channelIdForCategory(article.category, settings)
        || settings.channels.incoming
      : channelIdForCategory(article.category, settings)
        || settings.channels.incoming;

    if (settings.dryRun) {
      console.log('[NewsTech:DRY-RUN]', JSON.stringify({
        score: article.score,
        category: article.category,
        title: article.title,
        destination,
        reasons: article.reasons,
      }));
      // Preview only: do not report success, so the poller will NOT mark this story as seen.
      // This lets the same story publish normally after Dry Run is turned off.
      return false;
    }

    const channel = await this.getTextChannel(destination);
    if (!channel) {
      console.warn(`[NewsTech] No Discord destination for ${article.category}; will retry later: ${article.title}`);
      return false;
    }

    const category = getCategoryMeta(article.category);
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setAuthor({ name: `${BRAND.name} • ${BRAND.workspace}` })
      .setTitle(article.title.slice(0, 256))
      .setURL(article.url)
      .setDescription((article.summary || 'Open the source to read the full story.').slice(0, 1500))
      .addFields(
        { name: 'SOURCE', value: article.source.name.slice(0, 1024), inline: true },
        { name: 'TOPIC', value: `${category.emoji} ${category.label}`, inline: true },
        { name: 'PRIORITY', value: `${getPriorityLabel(article.score)} • ${article.score}/100`, inline: true },
      )
      .setFooter({
        text: `${BRAND.signature} • ${article.source.official ? 'OFFICIAL SOURCE' : 'SELECTED SOURCE'}`,
      })
      .setTimestamp(article.publishedAt ?? new Date());

    await channel.send({
      content: isBreaking ? '🚨 **NewsTech Alert — high-value story**' : undefined,
      embeds: [embed],
      components: [workflowButtons()],
      allowedMentions: { parse: [] },
    });

    return true;
  }
}
