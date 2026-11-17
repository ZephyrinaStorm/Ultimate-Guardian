const { SlashCommandBuilder } = require('discord.js');
const { P, reply, requirePerm, targetMember, record, duration } = require('../utils');
const reasonOption = o => o.setName('reason').setDescription('Reason for this action').setMaxLength(400);
const targetOption = o => o.setName('target').setDescription('Server member').setRequired(true);
const commands = [];
for (const name of ['ban', 'kick', 'warn']) {
  const permission = {ban:P.BanMembers,kick:P.KickMembers,warn:P.ModerateMembers}[name];
  commands.push({ data: new SlashCommandBuilder().setName(name).setDescription(`${name[0].toUpperCase()+name.slice(1)} a server member`).setDefaultMemberPermissions(permission).addUserOption(targetOption).addStringOption(reasonOption), async execute(i) {
    requirePerm(i, permission, name === 'warn' ? null : permission);
    const target = await targetMember(i, name === 'ban' ? 'bannable' : name === 'kick' ? 'kickable' : null);
    const reason = i.options.getString('reason') || 'No reason supplied';
    await i.deferReply({ephemeral:true});
    if (name === 'ban') await target.ban({reason});
    if (name === 'kick') await target.kick(reason);
    const id = await record(i.client, i.guild, name, target.id, i.user.id, reason);
    let dm = '';
    if (name === 'warn') { const sent = await target.send({content:`You were warned in ${i.guild.name}: ${reason}`,allowedMentions:{parse:[]}}).then(()=>true).catch(()=>false); dm = sent ? '\nWarning delivered by DM.' : '\nDM unavailable; the warning is saved.'; }
    await reply(i, `Case #${id} • ${name}`, `${target.user.tag}: ${reason}${dm}`);
  }});
}
const mod = new SlashCommandBuilder().setName('mod').setDescription('Moderation tools').setDefaultMemberPermissions(P.ModerateMembers);
for (const name of ['mute','unmute']) mod.addSubcommand(s=>{s.setName(name).setDescription(name === 'mute' ? 'Timeout a member' : 'Remove a timeout').addUserOption(targetOption); if(name==='mute') s.addStringOption(o=>o.setName('duration').setDescription('Examples: 10m, 1h, 7d; maximum 28d').setRequired(true)); return s.addStringOption(reasonOption);});
mod.addSubcommand(s=>s.setName('unban').setDescription('Unban a user by ID').addStringOption(o=>o.setName('user-id').setDescription('Discord user ID').setRequired(true)).addStringOption(reasonOption));
mod.addSubcommand(s=>s.setName('purge').setDescription('Delete recent messages, up to 14 days old').addIntegerOption(o=>o.setName('amount').setDescription('Messages to remove').setRequired(true).setMinValue(1).setMaxValue(100)));
commands.push({data:mod, async execute(i){
 const sub=i.options.getSubcommand(); const permission=sub==='unban'?P.BanMembers:sub==='purge'?P.ManageMessages:P.ModerateMembers; requirePerm(i,permission);
 await i.deferReply({ephemeral:true}); const reason=i.options.getString('reason')||'No reason supplied';
 if(sub==='purge'){ const removed=await i.channel.bulkDelete(i.options.getInteger('amount'),true); await record(i.client,i.guild,sub,null,i.user.id,`Removed ${removed.size} messages`); return reply(i,'Messages removed',`Deleted ${removed.size} messages. Messages older than 14 days are skipped.`); }
 if(sub==='unban'){ const id=i.options.getString('user-id'); if(!/^\d{17,20}$/.test(id))throw new Error('Enter a valid Discord user ID.'); await i.guild.members.unban(id,reason); await record(i.client,i.guild,sub,id,i.user.id,reason); return reply(i,'User unbanned',id); }
 const target=await targetMember(i,'moderatable'); const ms=sub==='mute'?duration(i.options.getString('duration')):null;
 if(sub==='mute'&&(!Number.isFinite(ms)||ms<1000||ms>28*86400000))throw new Error('Use a duration between 1s and 28d.');
 await target.timeout(ms,reason); const id=await record(i.client,i.guild,sub,target.id,i.user.id,reason); await reply(i,`Case #${id}`,`${sub} completed for ${target.user.tag}.`);
}});
commands.push({data:new SlashCommandBuilder().setName('cases').setDescription('View recent moderation cases').setDefaultMemberPermissions(P.ModerateMembers).addUserOption(o=>o.setName('target').setDescription('Filter by user')),async execute(i){requirePerm(i,P.ModerateMembers,null);const rows=i.client.store.cases(i.guildId,i.options.getUser('target')?.id);await reply(i,'Recent moderation cases',rows.map(r=>`**#${r.id} ${r.action}** • ${r.target||'server'}\n${r.reason}`).join('\n\n')||'No cases recorded.');}});
module.exports=commands;
