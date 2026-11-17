const { SlashCommandBuilder, ChannelType, AttachmentBuilder }=require('discord.js');
const {P,reply,embed,requirePerm}=require('../utils');
const data=new SlashCommandBuilder().setName('ticket').setDescription('Private support tickets')
.addSubcommand(s=>s.setName('open').setDescription('Open a private ticket').addStringOption(o=>o.setName('subject').setDescription('Brief description').setRequired(true).setMaxLength(200)))
.addSubcommand(s=>s.setName('close').setDescription('Close this ticket and lock the opener’s access'))
.addSubcommand(s=>s.setName('claim').setDescription('Claim this ticket as support staff'))
.addSubcommand(s=>s.setName('transcript').setDescription('Export up to 500 recent ticket messages privately'));
const opening=new Set();
module.exports=[{data,async execute(i){
 const c=i.client.store.get(i.guildId),sub=i.options.getSubcommand();
 const staff=i.memberPermissions.has(P.ManageChannels)||(c.supportRole&&i.member.roles.cache.has(c.supportRole));
 if(sub==='open'){
  if(!c.supportRole||!c.ticketCategory)throw new Error('Staff must run /config tickets first.');
  if(Object.values(c.tickets).some(t=>t.owner===i.user.id&&t.status==='open'))throw new Error('You already have an open ticket.');
  if(Object.values(c.tickets).filter(t=>t.status==='open').length>=100)throw new Error('This server has reached 100 open tickets.');
  const key=`${i.guildId}:${i.user.id}`;if(opening.has(key))throw new Error('Your ticket is being created.');opening.add(key);
  let channel;
  try{
   await i.deferReply({ephemeral:true});
   const category=await i.guild.channels.fetch(c.ticketCategory);if(category?.type!==ChannelType.GuildCategory)throw new Error('Ticket category is unavailable. Ask staff to reconfigure tickets.');
   channel=await i.guild.channels.create({name:`ticket-${i.user.id.slice(-6)}`,type:ChannelType.GuildText,parent:c.ticketCategory,permissionOverwrites:[{id:i.guildId,deny:[P.ViewChannel]},{id:i.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles]},{id:c.supportRole,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},{id:i.client.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.ManageChannels]}]});
   await channel.send({embeds:[embed('Support ticket',`Opened by <@${i.user.id}>\n${i.options.getString('subject')}\nUse /ticket close when resolved.`)],allowedMentions:{parse:[]}});
   i.client.store.update(i.guildId,v=>{v.tickets[channel.id]={owner:i.user.id,subject:i.options.getString('subject'),status:'open',createdAt:new Date().toISOString(),claimedBy:null};});
   await reply(i,'Ticket opened',`Your private ticket is <#${channel.id}>.`);
  }catch(e){if(channel&&!i.client.store.get(i.guildId).tickets[channel.id])await channel.delete('Ticket setup failed').catch(()=>{});throw e;}finally{opening.delete(key);}return;
 }
 const ticket=c.tickets[i.channelId];if(!ticket)throw new Error('Use this command inside a ticket channel.');
 if(!staff&&ticket.owner!==i.user.id)throw new Error('Only the ticket opener or support staff may do that.');
 await i.deferReply({ephemeral:true});
 if(sub==='claim'){if(!staff)throw new Error('Only support staff may claim tickets.');if(ticket.status!=='open')throw new Error('This ticket is closed.');i.client.store.update(i.guildId,v=>v.tickets[i.channelId].claimedBy=i.user.id);return reply(i,'Ticket claimed',`Claimed by ${i.user.tag}.`);}
 if(sub==='close'){
  if(ticket.status!=='open')throw new Error('This ticket is already closed.');
  await i.channel.permissionOverwrites.edit(ticket.owner,{ViewChannel:false,SendMessages:false});
  i.client.store.update(i.guildId,v=>{v.tickets[i.channelId].status='closed';v.tickets[i.channelId].closedAt=new Date().toISOString();});
  await i.channel.send({embeds:[embed('Ticket closed','The channel is retained for staff. Export a transcript before deleting it manually.')],allowedMentions:{parse:[]}});
  return reply(i,'Ticket closed','The opener’s channel access has been removed. Staff can export a transcript.');
 }
 const messages=[];let before;
 while(messages.length<500){const batch=await i.channel.messages.fetch({limit:100,before});if(!batch.size)break;messages.push(...batch.values());before=batch.last().id;}
 const text=messages.reverse().map(m=>`[${m.createdAt.toISOString()}] ${m.author.tag} (${m.author.id}): ${m.content}\n${[...m.attachments.values()].map(a=>a.url).join('\n')}`).join('\n');
 await i.editReply({content:'Up to 500 recent messages. Attachments are links, not archived files.',files:[new AttachmentBuilder(Buffer.from(text),{name:`ticket-${i.channelId}.txt`})],allowedMentions:{parse:[]}});
}}];
