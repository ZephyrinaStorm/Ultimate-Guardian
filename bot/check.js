const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'||e.name==='.git'?[]:e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.js')?[path.join(dir,e.name)]:[]);}
for(const file of walk(path.resolve(__dirname,'..'))){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status){console.error(result.stderr);process.exit(1);}}
const commands=require('./load-commands').loadCommands();const names=new Set();let actions=0;
for(const c of commands){const data=c.data.toJSON();if(names.has(data.name)||typeof c.execute!=='function')throw new Error(`Invalid command ${data.name}`);names.add(data.name);actions+=data.options?.filter(o=>o.type===1).length||1;}
console.log(`Syntax valid. ${commands.length} unique slash command groups, ${actions} command actions serialized.`);
