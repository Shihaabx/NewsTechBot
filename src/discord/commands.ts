import {
  Client,
  TextChannel,
  type ButtonInteraction,
} from 'discord.js';
import { SettingsStore } from '../control/settings.js';
import { workflowButtons } from './publisher.js';

export function isWorkflowAuthorized(userId: string, settingsStore: SettingsStore) {
  const ids = settingsStore.get().allowedUserIds;
  return ids.length > 0 && ids.includes(userId);
}

export function attachInteractionHandler(
  client: Client,
  settingsStore: SettingsStore,
) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('newstech:')) return;

    try {
      if (!isWorkflowAuthorized(interaction.user.id, settingsStore)) {
        const hasAllowlist = settingsStore.get().allowedUserIds.length > 0;
        await interaction.reply({
          content: hasAllowlist
            ? '⛔ This NewsTech control is private.'
            : '🔒 NewsTech workflow controls are locked until an allowed Discord user ID is configured in the Dashboard.',
          ephemeral: true,
        });
        return;
      }

      await handleWorkflowButton(interaction, settingsStore);
    } catch (error) {
      console.error('[NewsTech] Discord workflow interaction failed', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ NewsTech could not complete that action.', ephemeral: true });
      } else if (interaction.deferred) {
        await interaction.editReply('❌ NewsTech could not complete that action.');
      }
    }
  });
}

export async function handleWorkflowButton(interaction: ButtonInteraction, settingsStore: SettingsStore) {
  const action = interaction.customId === 'newstech:idea'
    ? 'idea'
    : interaction.customId === 'newstech:used'
      ? 'used'
      : null;

  if (!action) return;
  await interaction.deferReply({ ephemeral: true });

  const settings = settingsStore.get();
  const targetId = action === 'idea'
    ? settings.channels.videoIdeas
    : settings.channels.usedNews;

  if (!targetId) {
    await interaction.editReply('⚠️ Configure the target channel from the NewsTech Dashboard first.');
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

  await interaction.message.edit({ components: [workflowButtons(action)] });
  await interaction.editReply(action === 'idea' ? '💡 Saved to video ideas.' : '✅ Marked as used.');
}
