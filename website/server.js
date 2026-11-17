require('dotenv').config();
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const publicFiles=new Set(['index.html','styles.css','script.js','config.js','commands.json','shield.svg']);
function publicConfig(){return {clientId:process.env.DISCORD_CLIENT_ID||'',supportUrl:process.env.SUPPORT_URL||'https://github.com/ZephyrinaStorm/Ultimate-Guardian/issues'};}
function startServer(status=()=>({online:null,latency:null,uptime:null}),port=Number(process.env.PORT)||3000){
 const server=http.createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'");
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  const url=new URL(req.url,'http://localhost');
  const send=(type,body,code=200)=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);};
  if(url.pathname==='/api/status')return send('application/json',JSON.stringify(status()));
  if(url.pathname==='/healthz')return send('application/json',JSON.stringify({website:'ok',bot:status().online}));
  if(url.pathname==='/api/config')return send('application/json',JSON.stringify(publicConfig()));
  let file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!publicFiles.has(file))return send('text/plain','Not found',404);
  const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
  try{return send(types[path.extname(file)],fs.readFileSync(path.join(__dirname,file)));}catch{return send('text/plain','Not found',404);}
 });
 server.listen(port,'0.0.0.0',()=>console.log(`Public website listening on port ${server.address().port}`));return server;
}
if(require.main===module)startServer();module.exports={startServer,publicConfig};
