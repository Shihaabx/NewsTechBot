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
import { channelIdForCategory } from './channels.js';

export class DiscordPublisher {
  readonly client = new Client({ intents: [GatewayIntentBits.Guilds] });

  async start() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error('DISCORD_BOT_TOKEN is required');
    await this.client.login(token);
  }

  async stop() { this.client.destroy(); }

  private async getTextChannel(id?: string): Promise<TextChannel | null> {
    if (!id) return null;
    const channel = await this.client.channels.fetch(id);
    return channel?.isTextBased() && 'send' in channel ? channel as TextChannel : null;
  }

  async publish(article: ScoredArticle, minScore: number, breakingMinScore: number) {
    if (article.blocked || article.score < minScore) return false;
    const destination = article.breaking && article.score >= breakingMinScore
      ? process.env.DISCORD_CHANNEL_BREAKING || channelIdForCategory(article.category)
      : channelIdForCategory(article.category) || process.env.DISCORD_CHANNEL_INCOMING;

    if (process.env.DRY_RUN === 'true') {
      console.log('[DRY RUN]', article.score, article.category, article.title, destination, article.reasons);
      return true;
    }

    const channel = await this.getTextChannel(destination);
    if (!channel) {
      console.warn(`No Discord channel configured for ${article.category}; skipping ${article.title}`);
      return false;
    }

    const embed = new EmbedBuilder()
      .setTitle(article.title.slice(0, 256))
      .setURL(article.url)
      .setDescription((article.summary || 'No summary available.').slice(0, 1500))
      .addFields(
        { name: 'Source', value: article.source.name, inline: true },
        { name: 'Category', value: article.category, inline: true },
        { name: 'Value score', value: `${article.score}/100`, inline: true },
      )
      .setFooter({ text: `NewsTech • ${article.source.official ? 'Official source' : 'Selected source'}` })
      .setTimestamp(article.publishedAt ?? new Date());

    const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('newstech:idea').setLabel('Video Idea').setEmoji('💡').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('newstech:used').setLabel('Used').setEmoji('✅').setStyle(ButtonStyle.Secondary),
    );

    await channel.send({
      content: article.breaking && article.score >= breakingMinScore ? '🚨 **Important tech news**' : undefined,
      embeds: [embed],
      components: [actions],
    });
    return true;
  }
}
