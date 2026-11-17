require('dotenv').config();
const {Client,Collection,GatewayIntentBits,Events,Partials}=require('discord.js');
const {Store}=require('./store');const {loadCommands}=require('./load-commands');const {reply}=require('./utils');const {installProtection}=require('./protection');const {startServer}=require('../website/server');
if(!process.env.DISCORD_BOT_TOKEN){console.error('Set DISCORD_BOT_TOKEN in your .env or hosting environment. For website-only preview use npm run website.');process.exit(1);}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildModeration],partials:[Partials.Message,Partials.Channel],allowedMentions:{parse:[]}});
client.store=new Store();client.commands=new Collection(loadCommands().map(c=>[c.data.name,c]));
const dispose=installProtection(client);const server=startServer(()=>({online:client.isReady(),latency:client.isReady()?Math.max(0,client.ws.ping):null,uptime:client.isReady()?Math.floor(client.uptime/1000):0}));
client.once(Events.ClientReady,c=>{console.log(`Ultimate Guardian online as ${c.user.tag}; ${c.guilds.cache.size} servers. Use npm run deploy to register commands.`);});
client.on(Events.InteractionCreate,async i=>{
 if(!i.isChatInputCommand())return;
 try{
  if(!i.inGuild())throw new Error('Use this command in a server.');
  const command=client.commands.get(i.commandName);if(!command)throw new Error('Unknown command. Ask the operator to register commands again.');
  if(!i.guild.members.me)await i.guild.members.fetchMe();
  await command.execute(i);
 }catch(e){console.error(`Command ${i.commandName}:`,e.message);await reply(i,'Action could not finish',e.message).catch(err=>console.error('Reply failed:',err.message));}
});
client.on(Events.Error,e=>console.error('Discord connection error:',e.message));
let stopping=false;
function shutdown(code=0){if(stopping)return;stopping=true;dispose();client.destroy();server.close(()=>{client.store.close();process.exit(code);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
client.login(process.env.DISCORD_BOT_TOKEN).catch(e=>{console.error('Discord login failed:',e.message);shutdown(1);});
