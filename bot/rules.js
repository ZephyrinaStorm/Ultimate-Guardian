function domains(text){return [...String(text).matchAll(/(?:https?:\/\/|www\.)[^\s<>]+/gi)].map(m=>{try{return new URL(m[0].startsWith('www.')?`https://${m[0]}`:m[0]).hostname.toLowerCase().replace(/^www\./,'');}catch{return null;}}).filter(Boolean);}
function blockedDomain(host,entries){return entries.some(d=>host===d||host.endsWith(`.${d}`));}
function scam(text){return /(?:free|claim|gift)\s+(?:discord\s+)?nitro/i.test(text)&&/(?:https?:\/\/|discord\.gg\/|www\.)/i.test(text)||/(?:verify|verification).{0,50}(?:password|token|seed phrase)/i.test(text);}
function messageRule(text,user,config){
 const content=String(text).toLowerCase(),hosts=domains(text);
 if(config.blacklist.user.includes(user))return 'blacklisted user';
 if(config.blacklist.word.some(w=>content.includes(w)))return 'blacklisted term';
 if(hosts.some(h=>blockedDomain(h,config.blacklist.domain)))return 'blacklisted domain';
 if(config.modules['anti-link']&&/(?:https?:\/\/|www\.|discord(?:app)?\.com\/invite\/|discord\.gg\/)/i.test(text))return 'unauthorized link';
 if(config.modules['anti-scam']&&scam(text))return 'suspected scam (rule-based)';
 return null;
}
module.exports={domains,blockedDomain,scam,messageRule};
