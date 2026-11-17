const { ChannelType } = require('discord.js');
const { P } = require('./utils');
const running=new Set();
async function lockdown(guild, store, enabled) {
 if(running.has(guild.id))throw new Error('A lockdown change is already running. Try again shortly.');
 running.add(guild.id);try{return await applyLockdown(guild,store,enabled);}finally{running.delete(guild.id);}
}
async function applyLockdown(guild, store, enabled) {
 let saved=store.get(guild.id).lockdown;
 if(enabled&&saved) return 'Server lockdown is already active.';
 if(!enabled&&!saved)return 'No stored lockdown to reverse.';
 if(enabled){saved={};store.update(guild.id,c=>c.lockdown=saved);}
 const failures=[]; const channels=await guild.channels.fetch();
 for(const channel of channels.values()){
  if(!channel||![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type))continue;
  if(enabled){const overwrite=channel.permissionOverwrites.cache.get(guild.id); saved[channel.id]=overwrite?.allow.has(P.SendMessages)?true:overwrite?.deny.has(P.SendMessages)?false:null; store.update(guild.id,c=>c.lockdown={...saved});}
  else if(!(channel.id in saved))continue;
  try{await channel.permissionOverwrites.edit(guild.id,{SendMessages:enabled?false:saved[channel.id]},{reason:enabled?'GuardBot lockdown':'GuardBot unlock'});if(!enabled){delete saved[channel.id];store.update(guild.id,c=>c.lockdown={...saved});}}catch{failures.push(channel.id);}
 }
 if(!enabled&&!failures.length)store.update(guild.id,c=>c.lockdown=null);
 return `${enabled?'Lockdown applied':'Previous @everyone send permissions restored'}.${failures.length?` Failed channels: ${failures.join(', ')}. Retry after fixing permissions.`:''} Explicit role/member allows may override @everyone; staff should check channel access.`;
}
module.exports={lockdown};
