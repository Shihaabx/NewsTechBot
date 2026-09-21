import {
  Client,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { AppEnv } from '../config/env.js';
import { BRAND } from '../brand.js';
import { workflowButtons } from './publisher.js';

export interface RuntimeStatus {
  startedAt: string;
  lastPollAt?: string;
  lastPollDurationMs?: number;
  enabledSources: number;
  fetched: number;
  published: number;
  filtered: number;
  failedSources: number;
}

const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Show NewsTech newsroom status'),
  new SlashCommandBuilder().setName('sources').setDescription('Show enabled NewsTech sources'),
].map((command) => command.toJSON());

export async function registerCommands(clientId: string, env: AppEnv) {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(clientId, env.DISCORD_GUILD_ID), { body: commands });
}

function isAuthorized(userId: string, env: AppEnv) {
  return env.allowedUserIds.length === 0 || env.allowedUserIds.includes(userId);
}

async function deny(interaction: ChatInputCommandInteraction | ButtonInteraction) {
  await interaction.reply({ content: '⛔ This NewsTech control is private.', ephemeral: true });
}

export function attachInteractionHandler(
  client: Client,
  env: AppEnv,
  getSources: () => string[],
  getStatus: () => RuntimeStatus,
) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
      if (!isAuthorized(interaction.user.id, env)) {
        await deny(interaction);
        return;
      }

      if (interaction.isChatInputCommand()) await handleCommand(interaction, getSources, getStatus);
      else await handleButton(interaction, env);
    } catch (error) {
      console.error('[NewsTech] Discord interaction failed', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ NewsTech could not complete that action.', ephemeral: true });
      }
    }
  });
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  getSources: () => string[],
  getStatus: () => RuntimeStatus,
) {
  if (interaction.commandName === 'status') {
    const status = getStatus();
    const lastPoll = status.lastPollAt
      ? `<t:${Math.floor(new Date(status.lastPollAt).getTime() / 1000)}:R>`
      : 'not yet';

    await interaction.reply({
      content: [
        `**${BRAND.name} • ${BRAND.workspace}**`,
        '✅ Online',
        `Sources: **${status.enabledSources}**`,
        `Last poll: **${lastPoll}**`,
        `Fetched: **${status.fetched}** • Published: **${status.published}** • Filtered: **${status.filtered}**`,
        `Feed failures: **${status.failedSources}**`,
      ].join('\n'),
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === 'sources') {
    const sources = getSources();
    await interaction.reply({
      content: sources.length
        ? `**NewsTech sources**\n${sources.map((source) => `• ${source}`).join('\n')}`
        : 'No NewsTech sources are enabled yet.',
      ephemeral: true,
    });
  }
}

async function handleButton(interaction: ButtonInteraction, env: AppEnv) {
  const action = interaction.customId === 'newstech:idea'
    ? 'idea'
    : interaction.customId === 'newstech:used'
      ? 'used'
      : null;

  if (!action) return;

  await interaction.deferReply({ ephemeral: true });

  const targetId = action === 'idea'
    ? env.DISCORD_CHANNEL_VIDEO_IDEAS
    : env.DISCORD_CHANNEL_USED_NEWS;

  if (!targetId) {
    await interaction.editReply('⚠️ Target channel is not configured.');
    return;
  }

  const target = await interaction.client.channels.fetch(targetId);
  if (!target?.isTextBased() || !('send' in target)) {
    await interaction.editReply('⚠️ Target channel is unavailable.');
    return;
  }

  await (target as TextChannel).send({
    content: action === 'idea'
      ? `💡 **NewsTech → Video Idea** • saved by <@${interaction.user.id}>`
      : `✅ **NewsTech → Used** • marked by <@${interaction.user.id}>`,
    embeds: interaction.message.embeds,
    allowedMentions: { users: [interaction.user.id] },
  });

  await interaction.message.edit({
    components: [workflowButtons(action)],
  });

  await interaction.editReply(action === 'idea' ? '💡 Saved to video ideas.' : '✅ Marked as used.');
}
