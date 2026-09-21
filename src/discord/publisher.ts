import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  TextChannel,
} from 'discord.js';
import type { ScoredArticle } from '../core/types.js';
import type { AppEnv } from '../config/env.js';
import { BRAND, getCategoryMeta, getPriorityLabel } from '../brand.js';
import { channelIdForCategory } from './channels.js';

function workflowButtons(disabled: 'idea' | 'used' | null = null) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('newstech:idea')
      .setLabel('Video Idea')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled === 'idea'),
    new ButtonBuilder()
      .setCustomId('newstech:used')
      .setLabel('Used')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled === 'used'),
  );
}

export { workflowButtons };

export class DiscordPublisher {
  readonly client = new Client({ intents: [GatewayIntentBits.Guilds] });

  constructor(private readonly env: AppEnv) {}

  async start() {
    await this.client.login(this.env.DISCORD_BOT_TOKEN);
  }

  async stop() {
    this.client.destroy();
  }

  private async getTextChannel(id?: string): Promise<TextChannel | null> {
    if (!id) return null;
    const channel = await this.client.channels.fetch(id);
    return channel?.isTextBased() && 'send' in channel ? channel as TextChannel : null;
  }

  async publish(article: ScoredArticle) {
    if (article.blocked || article.score < this.env.NEWS_MIN_SCORE) return false;

    const isBreaking = article.breaking && article.score >= this.env.BREAKING_MIN_SCORE;
    const destination = isBreaking
      ? this.env.DISCORD_CHANNEL_BREAKING
        || channelIdForCategory(article.category, this.env)
        || this.env.DISCORD_CHANNEL_INCOMING
      : channelIdForCategory(article.category, this.env)
        || this.env.DISCORD_CHANNEL_INCOMING;

    if (this.env.DRY_RUN) {
      console.log(
        '[NewsTech:DRY-RUN]',
        JSON.stringify({
          score: article.score,
          category: article.category,
          title: article.title,
          destination,
          reasons: article.reasons,
        }),
      );
      return true;
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
