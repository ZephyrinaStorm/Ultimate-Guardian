const {Events,AuditLogEvent,PermissionFlagsBits:P}=require('discord.js');
const {record}=require('./utils');const {messageRule}=require('./rules');const {lockdown}=require('./lockdown');
function installProtection(client){
 const spam=new Map(),joins=new Map(),nukes=new Map(),raidLocks=new Set(),webhookLocks=new Set();
 const safe=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>console.error('Protection event:',e.message));
 const prune=setInterval(()=>{const now=Date.now();for(const map of [spam,joins,nukes])for(const[k,v]of map)if(!v.length||now-v[v.length-1]>60000)map.delete(k);},60000);prune.unref();
 function count(map,key,ms){const now=Date.now(),times=(map.get(key)||[]).filter(t=>now-t<ms);times.push(now);map.set(key,times);return times.length;}
 const trusted=(guild,id,c)=>id===guild.ownerId||id===client.user.id||c.trusted.includes(id);
 async function deleteMessage(message,why){
  if(!message.deletable){await record(client,message.guild,'filter-failed',message.author.id,client.user.id,`Cannot delete message: ${why}`);return;}
  await message.delete();await record(client,message.guild,'message-filter',message.author.id,client.user.id,why);
 }
 async function filter(message){
  if(!message.guild||message.author.bot||message.webhookId)return;
  const c=client.store.get(message.guild.id),member=message.member||await message.guild.members.fetch(message.author.id).catch(()=>null);
  if(!member||member.permissions.has(P.Administrator))return;
  const why=messageRule(message.content,message.author.id,c);if(why)return deleteMessage(message,why);
  if(c.modules['anti-spam']&&count(spam,`${message.guild.id}:${message.author.id}`,5000)>=c.spamThreshold){
   await deleteMessage(message,'spam threshold exceeded');
   if(member.moderatable){await member.timeout(60000,'GuardBot anti-spam');await record(client,message.guild,'auto-timeout',member.id,client.user.id,'Anti-spam: 60 seconds');}
   spam.delete(`${message.guild.id}:${message.author.id}`);return;
  }

 }
 client.on(Events.MessageCreate,safe(filter));
 client.on(Events.MessageUpdate,safe(async(_,message)=>{if(message.partial)message=await message.fetch();await filter(message);}));
 client.on(Events.GuildMemberAdd,safe(async member=>{
  const guild=member.guild,c=client.store.get(guild.id),age=Date.now()-member.user.createdTimestamp;
  if(c.blacklist.user.includes(member.id)){if(member.kickable){await member.kick('GuardBot user blacklist');await record(client,guild,'auto-kick',member.id,client.user.id,'Blacklisted user joined');}else await record(client,guild,'blacklist-alert',member.id,client.user.id,'Could not kick blacklisted member');return;}
  if(c.modules['anti-new-account']&&age<c.newAccountDays*86400000){if(member.kickable){await member.kick('Account below configured minimum age');await record(client,guild,'auto-kick',member.id,client.user.id,`Account younger than ${c.newAccountDays} days`);}else await record(client,guild,'account-age-alert',member.id,client.user.id,'Could not kick young account');return;}
  if(c.modules['anti-alt']&&age<30*86400000&&!member.user.avatar)await record(client,guild,'account-review',member.id,client.user.id,'Young account without a custom avatar. Possible alternate account; manual review only.');
  if(c.modules['anti-raid']&&count(joins,guild.id,10000)>=c.raidThreshold&&!raidLocks.has(guild.id)){
   raidLocks.add(guild.id);try{const result=await lockdown(guild,client.store,true);await record(client,guild,'raid-lockdown',member.id,client.user.id,result);}finally{raidLocks.delete(guild.id);}joins.delete(guild.id);
  }
 }));
 async function audit(guild,type,targetId){
  if(!guild.members.me?.permissions.has(P.ViewAuditLog))return null;
  const logs=await guild.fetchAuditLogs({type,limit:10});return logs.entries.find(e=>(!targetId||e.targetId===targetId)&&Date.now()-e.createdTimestamp<15000);
 }
 async function nuke(guild,type,targetId){
  const c=client.store.get(guild.id);if(!c.modules['anti-nuke'])return;
  const entry=await audit(guild,type,targetId),id=entry?.executorId;if(!id||trusted(guild,id,c))return;
  if(count(nukes,`${guild.id}:${id}`,10000)<3)return;
  const member=await guild.members.fetch(id).catch(()=>null);
  let result='Unable to remove roles; review role order immediately.';
  if(member&&member.roles.highest.comparePositionTo(guild.members.me.roles.highest)<0){
   const dangerous=[P.Administrator,P.ManageChannels,P.ManageRoles,P.BanMembers,P.KickMembers,P.ManageWebhooks];
   const roles=member.roles.cache.filter(r=>r.id!==guild.id&&!r.managed&&r.editable&&dangerous.some(p=>r.permissions.has(p)));
   if(roles.size){await member.roles.remove(roles,'GuardBot anti-nuke threshold');result=`Removed ${roles.size} dangerous roles.`;}
  }
  await record(client,guild,'anti-nuke',id,client.user.id,`3 destructive actions within 10s. ${result} Already deleted objects are not automatically restored.`);
  nukes.delete(`${guild.id}:${id}`);
 }
 client.on(Events.ChannelDelete,safe(channel=>nuke(channel.guild,AuditLogEvent.ChannelDelete,channel.id)));
 client.on(Events.GuildRoleDelete,safe(role=>nuke(role.guild,AuditLogEvent.RoleDelete,role.id)));
 client.on(Events.GuildBanAdd,safe(ban=>nuke(ban.guild,AuditLogEvent.MemberBanAdd,ban.user.id)));
 client.on(Events.WebhooksUpdate,safe(async channel=>{
  const guild=channel.guild,c=client.store.get(guild.id);if(!c.modules['anti-webhook']||webhookLocks.has(channel.id))return;
  webhookLocks.add(channel.id);try{
   const entry=await audit(guild,AuditLogEvent.WebhookCreate);if(!entry?.executorId||trusted(guild,entry.executorId,c))return;
   const hooks=await channel.fetchWebhooks(),hook=hooks.get(entry.targetId);
   if(hook){await hook.delete('GuardBot: webhook created by untrusted actor');await record(client,guild,'webhook-removed',entry.executorId,client.user.id,`New webhook ${entry.targetId} removed. Use /config trust for authorized creators.`);}
  }finally{webhookLocks.delete(channel.id);}
 }));
 client.on(Events.ChannelDelete,safe(channel=>{if(!channel.guild)return;client.store.update(channel.guild.id,c=>{if(c.tickets[channel.id]){c.tickets[channel.id].status='deleted';} });}));
 client.on(Events.GuildDelete,safe(guild=>client.store.removeGuild(guild.id)));
 return ()=>clearInterval(prune);
}
module.exports={installProtection};
