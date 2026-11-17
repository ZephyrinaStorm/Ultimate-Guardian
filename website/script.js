'use strict';
const config={...window.GUARDBOT_CONFIG};
const $=selector=>document.querySelector(selector);
let commands=[];
function route(){const name=location.hash.slice(1)||'home';const page=document.getElementById(name);document.querySelectorAll('.page').forEach(p=>p.hidden=p!==page);if(!page||!page.classList.contains('page')){$('#not-found').hidden=false;document.querySelectorAll('.page').forEach(p=>{if(p.id!=='not-found')p.hidden=true;});}document.querySelectorAll('.header nav a').forEach(a=>{if(a.hash===`#${name}`)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.title=`${({home:'A calmer community starts here',features:'Features',commands:'Commands',setup:'Setup',status:'Status',privacy:'Privacy',terms:'Terms',support:'Support'})[name]||'Page not found'} — Ultimate Guardian`;window.scrollTo(0,0);if(name==='status')refreshStatus();}
function configure(){
 const valid=/^\d{17,20}$/.test(config.clientId||'');
 // No Administrator permission. The requested bitset covers the individual moderation and ticket tools.
 const permissions='1100317060246';
 document.querySelectorAll('.invite').forEach(a=>{a.href=valid?`https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=${permissions}&scope=bot%20applications.commands`:'#setup';if(valid){a.target='_blank';a.rel='noopener';}});
 if(valid)$('#invite-note').textContent='The application ID is configured. Invite the bot, then arrange its role and permissions.';
 try{const url=new URL(config.supportUrl);if(url.protocol==='https:')document.querySelectorAll('.support-link').forEach(a=>a.href=url.href);}catch{}
}
function renderCommands(){
 const query=$('#command-search').value.toLowerCase().trim(),rows=commands.filter(c=>`${c.name} ${c.description} ${c.options}`.toLowerCase().includes(query));
 $('#command-count').textContent=`${rows.length} of ${commands.length} command actions`;
 $('#command-list').replaceChildren();
 for(const row of rows){const article=document.createElement('article');article.className='command-row';const code=document.createElement('code');code.textContent=`/${row.name}`;const info=document.createElement('div');const description=document.createElement('p');description.textContent=row.description;const options=document.createElement('p');options.className='options';options.textContent=row.options?`Options: ${row.options}`:'No options';const copy=document.createElement('button');copy.className='copy';copy.textContent='Copy';copy.setAttribute('aria-label',`Copy /${row.name}`);copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`/${row.name}`);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',1800);}catch{copy.textContent='Select text';}});info.append(description,options);article.append(code,info,copy);$('#command-list').append(article);}
 $('#command-empty').hidden=rows.length>0;
}
let checking=false;
async function refreshStatus(){if(checking)return;checking=true;$('#status-refresh').disabled=true;
 try{
  if(!config.statusUrl)throw new Error('No status endpoint');
  const response=await fetch(config.statusUrl,{cache:'no-store',signal:AbortSignal.timeout(7000)});if(!response.ok)throw new Error('Status unavailable');const state=await response.json();
  if(state.online!==true&&state.online!==false)throw new Error('No connected bot');
  $('#status-title').textContent=state.online?'Bot connected':'Bot disconnected';$('#status-detail').textContent=state.online?'The bot process is connected to Discord.':'The website is reachable. The bot is not currently connected to Discord.';
  $('#status-dot').className=`status-dot ${state.online?'online':'offline'}`;$('#status-latency').textContent=state.online?`${state.latency??'—'} ms`:'—';$('#status-uptime').textContent=state.online?`${Math.floor(state.uptime/3600)}h ${Math.floor(state.uptime/60)%60}m`:'—';
 }catch{$('#status-title').textContent='Live bot status unavailable';$('#status-detail').textContent='This page cannot verify the bot’s connection. This does not establish whether the bot is online or offline.';$('#status-dot').className='status-dot';$('#status-latency').textContent='—';$('#status-uptime').textContent='—';}
 finally{$('#status-checked').textContent=new Date().toLocaleTimeString();checking=false;$('#status-refresh').disabled=false;}
}
$('#status-refresh').addEventListener('click',refreshStatus);$('#command-search').addEventListener('input',renderCommands);window.addEventListener('hashchange',route);
configure();route();
fetch('/api/config',{signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).then(data=>{if(data){Object.assign(config,data);configure();}}).catch(()=>{});
fetch('commands.json').then(r=>{if(!r.ok)throw new Error('Command list unavailable');return r.json();}).then(data=>{commands=data;renderCommands();}).catch(()=>{$('#command-count').textContent='The command list could not be loaded. Please reload the page or use /help in Discord.';});
