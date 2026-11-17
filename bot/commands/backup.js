const { SlashCommandBuilder, ChannelType, AttachmentBuilder }=require('discord.js');
const {P,reply,requirePerm}=require('../utils');
const data=new SlashCommandBuilder().setName('backup').setDescription('Back up and restore server structure').setDefaultMemberPermissions(P.Administrator)
.addSubcommand(s=>s.setName('create').setDescription('Capture roles, channels and overwrites').addStringOption(o=>o.setName('name').setDescription('Backup name').setRequired(true).setMaxLength(100)))
.addSubcommand(s=>s.setName('list').setDescription('Show latest 20 backups'));
for(const sub of ['download','delete','restore'])data.addSubcommand(s=>{s.setName(sub).setDescription(`${sub} a server structure backup`).addStringOption(o=>o.setName('id').setDescription('Backup UUID from /backup list').setRequired(true));if(sub==='restore')s.addStringOption(o=>o.setName('confirm').setDescription('Type RESTORE to recreate missing roles and channels').setRequired(true));return s;});
const restoring=new Set();
module.exports=[{data,async execute(i){
 requirePerm(i,P.Administrator,null);await i.deferReply({ephemeral:true});const sub=i.options.getSubcommand(),store=i.client.store;
 if(sub==='create'){
  await Promise.all([i.guild.roles.fetch(),i.guild.channels.fetch()]);
  const roles=i.guild.roles.cache.filter(r=>!r.managed&&r.id!==i.guildId).map(r=>({id:r.id,name:r.name,color:r.color,hoist:r.hoist,mentionable:r.mentionable,permissions:r.permissions.bitfield.toString(),position:r.position}));
  const types=[ChannelType.GuildCategory,ChannelType.GuildText,ChannelType.GuildVoice,ChannelType.GuildAnnouncement,ChannelType.GuildStageVoice,ChannelType.GuildForum];
  const channels=i.guild.channels.cache.filter(c=>types.includes(c.type)).map(c=>({id:c.id,name:c.name,type:c.type,parent:c.parentId,position:c.rawPosition,topic:c.topic??undefined,nsfw:c.nsfw??undefined,bitrate:c.bitrate??undefined,userLimit:c.userLimit??undefined,rateLimitPerUser:c.rateLimitPerUser??undefined,permissionOverwrites:c.permissionOverwrites.cache.map(o=>({id:o.id,type:o.type,allow:o.allow.bitfield.toString(),deny:o.deny.bitfield.toString()}))}));
  if(store.backups(i.guildId).length>=20)throw new Error('Delete an older backup first (maximum 20).');
  const id=store.backup(i.guildId,{name:i.options.getString('name'),guild:i.guildId,roles,channels});return reply(i,'Backup saved',`ID: ${id}\n${roles.length} roles and ${channels.length} channels. Messages, members, files, webhooks and integrations are not included.`);
 }
 if(sub==='list')return reply(i,'Structure backups',store.backups(i.guildId).map(b=>`**${b.name}** • ${b.at}\n${b.id}`).join('\n\n')||'No backups.');
 const id=i.options.getString('id'),backup=store.getBackup(i.guildId,id);if(!backup)throw new Error('Backup not found in this server.');
 if(sub==='delete'){store.deleteBackup(i.guildId,id);return reply(i,'Backup deleted',id);}
 if(sub==='download')return i.editReply({files:[new AttachmentBuilder(Buffer.from(JSON.stringify(backup,null,2)),{name:'server-structure.json'})]});
 if(i.options.getString('confirm')!=='RESTORE')throw new Error('Type RESTORE to confirm. This adds missing roles/channels without deleting existing ones.');
 if(!i.guild.members.me.permissions.has(P.ManageRoles|P.ManageChannels))throw new Error('Restore requires Manage Roles and Manage Channels.');
 if(restoring.has(i.guildId))throw new Error('A restore is already running.');restoring.add(i.guildId);
 try{
 await Promise.all([i.guild.roles.fetch(),i.guild.channels.fetch()]);
 const map=new Map([[i.guildId,i.guildId]]),errors=[];let roles=0,channels=0;
 // Persist ID remapping after each successful creation, so retries do not duplicate restored objects.
 const mappings=backup.restoredIds||{};
 const saveMapping=(old,newId)=>{mappings[old]=newId;store.db.prepare('UPDATE backups SET data=? WHERE guild=? AND id=?').run(JSON.stringify({...backup,restoredIds:mappings}),i.guildId,id);};
 for(const r of [...backup.roles].sort((a,b)=>a.position-b.position)){
  const existing=i.guild.roles.cache.get(r.id)||i.guild.roles.cache.get(mappings[r.id]);if(existing){map.set(r.id,existing.id);continue;}
  try{const created=await i.guild.roles.create({name:r.name,color:r.color,hoist:r.hoist,mentionable:r.mentionable,permissions:BigInt(r.permissions),reason:'GuardBot structure restore'});map.set(r.id,created.id);saveMapping(r.id,created.id);roles++;}catch(e){errors.push(`Role ${r.name}: ${e.message}`);}
 }
 for(const c of [...backup.channels].sort((a,b)=>(a.type===ChannelType.GuildCategory?-1:0)-(b.type===ChannelType.GuildCategory?-1:0)||a.position-b.position)){
  const existing=i.guild.channels.cache.get(c.id)||i.guild.channels.cache.get(mappings[c.id]);if(existing){map.set(c.id,existing.id);continue;}
  if(c.parent&&!map.has(c.parent)){errors.push(`Skipped ${c.name}: parent unavailable`);continue;}
  // Do not recreate a channel if any role overwrite could not be resolved; dropping a deny could expose it.
  if(c.permissionOverwrites.some(o=>o.type===0&&!map.has(o.id))){errors.push(`Skipped ${c.name}: an overwrite role is unavailable`);continue;}
  try{const {id:old,parent,permissionOverwrites,...options}=c;const created=await i.guild.channels.create({...options,parent:parent?map.get(parent):undefined,permissionOverwrites:permissionOverwrites.map(o=>({...o,id:map.get(o.id)||o.id,allow:BigInt(o.allow),deny:BigInt(o.deny)})),reason:'GuardBot structure restore'});map.set(old,created.id);saveMapping(old,created.id);channels++;}catch(e){errors.push(`Channel ${c.name}: ${e.message}`);}
 }
 await reply(i,'Restore result',`Created ${roles} roles and ${channels} channels. Existing objects were retained. Role positions and member role assignments require manual review.\n${errors.length?errors.join('\n'):'No API errors.'}`);
 }finally{restoring.delete(i.guildId);}
}}];
