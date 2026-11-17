const { EmbedBuilder, PermissionFlagsBits: P } = require('discord.js');
function embed(title, description) { return new EmbedBuilder().setColor(0x5ee1bd).setTitle(title).setDescription(String(description).slice(0, 4096)).setFooter({ text: 'Ultimate Guardian • Community protection' }).setTimestamp(); }
async function reply(i, title, description) { const payload = { embeds: [embed(title, description)], allowedMentions: { parse: [] } }; return i.deferred || i.replied ? i.editReply(payload) : i.reply({ ...payload, ephemeral: true }); }
function requirePerm(i, perm, botPerm = perm) {
  if (!i.inGuild() || !i.memberPermissions?.has(perm)) throw new Error('You do not have the required server permission.');
  if (botPerm && !i.guild.members.me?.permissions.has(botPerm)) throw new Error('The bot is missing a required permission. Check its role.');
}
async function targetMember(i, action) {
  const user = i.options.getUser('target', true);
  if ([i.user.id, i.client.user.id, i.guild.ownerId].includes(user.id)) throw new Error('You cannot use this action on yourself, this bot, or the server owner.');
  const target = await i.guild.members.fetch(user.id).catch(() => null);
  if (!target) throw new Error('That user is not a member of this server.');
  const moderator = await i.guild.members.fetch(i.user.id);
  if (i.user.id !== i.guild.ownerId && target.roles.highest.comparePositionTo(moderator.roles.highest) >= 0) throw new Error('Your highest role must be above the target member.');
  if (action && !target[action]) throw new Error('The bot cannot act on this member. Check role order and permissions.');
  return target;
}
async function record(client, guild, action, target, moderator, reason) {
  const id = client.store.addCase(guild.id, { action, target, moderator, reason });
  const log = client.store.get(guild.id).logChannel;
  if (log) {
    const channel = await guild.channels.fetch(log).catch(() => null);
    if (channel?.isTextBased()) await channel.send({ embeds: [embed(`Case #${id} • ${action}`, `User: ${target || '—'}\nActor: ${moderator}\n${reason}`)], allowedMentions: { parse: [] } }).catch(e => console.error('Log delivery:', e.message));
  }
  return id;
}
function duration(text) { const m = /^(\d+)(s|m|h|d)$/.exec(text || ''); return m ? Number(m[1]) * ({s:1000,m:60000,h:3600000,d:86400000})[m[2]] : NaN; }
module.exports = { P, embed, reply, requirePerm, targetMember, record, duration };
