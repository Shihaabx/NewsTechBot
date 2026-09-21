import {
  Client,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';

const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Show NewsTech bot status'),
  new SlashCommandBuilder().setName('sources').setDescription('Show enabled news sources'),
].map((command) => command.toJSON());

export async function registerCommands(clientId: string, guildId: string, token: string) {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
}

export function attachInteractionHandler(client: Client, getSources: () => string[]) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) await handleCommand(interaction, getSources);
      else if (interaction.isButton()) await handleButton(interaction);
    } catch (error) {
      console.error('Discord interaction failed', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ NewsTech could not complete that action.', ephemeral: true });
      }
    }
  });
}

async function handleCommand(interaction: ChatInputCommandInteraction, getSources: () => string[]) {
  if (interaction.commandName === 'status') {
    await interaction.reply({ content: '✅ NewsTech is online and monitoring selected sources.', ephemeral: true });
    return;
  }
  if (interaction.commandName === 'sources') {
    const sources = getSources();
    await interaction.reply({
      content: sources.length ? `Enabled sources:\n${sources.map((s) => `• ${s}`).join('\n')}` : 'No sources are enabled yet.',
      ephemeral: true,
    });
  }
}

async function handleButton(interaction: ButtonInteraction) {
  const targetId = interaction.customId === 'newstech:idea'
    ? process.env.DISCORD_CHANNEL_VIDEO_IDEAS
    : interaction.customId === 'newstech:used'
      ? process.env.DISCORD_CHANNEL_USED_NEWS
      : undefined;

  if (!targetId) {
    await interaction.reply({ content: '⚠️ Target channel is not configured in `.env`.', ephemeral: true });
    return;
  }

  const target = await interaction.client.channels.fetch(targetId);
  if (!target?.isTextBased() || !('send' in target)) {
    await interaction.reply({ content: '⚠️ Target channel is unavailable.', ephemeral: true });
    return;
  }

  const sourceMessage = interaction.message;
  await (target as TextChannel).send({
    content: interaction.customId === 'newstech:idea'
      ? `💡 **Video idea** • saved by <@${interaction.user.id}>`
      : `✅ **Used news** • marked by <@${interaction.user.id}>`,
    embeds: sourceMessage.embeds,
  });

  await interaction.reply({
    content: interaction.customId === 'newstech:idea' ? '💡 Saved to video ideas.' : '✅ Saved to used news.',
    ephemeral: true,
  });
}
