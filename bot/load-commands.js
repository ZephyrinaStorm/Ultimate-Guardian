const fs=require('node:fs'),path=require('node:path');
function loadCommands(){return fs.readdirSync(path.join(__dirname,'commands')).filter(n=>n.endsWith('.js')).sort().flatMap(n=>require(path.join(__dirname,'commands',n)));}
module.exports={loadCommands};
