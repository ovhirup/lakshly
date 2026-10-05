import { sourceFor, type Source, type Search, type SourceReference } from '../setup/catalog';
import { gmailQuery, outlookQuery } from '../setup/links';
export type SyncProvider='gmail'|'graph'|'imap';
export type SyncQuery={key:string;q:string}|{key:string;search:string};
export interface SyntheticMessage { id:string;date:string;from:string;subject:string;attachments?:{name:string;type:string;encrypted?:boolean}[] }
export interface ReadLog {messageId:string;date:string;from:string;subject:string;matched:string[];route:string;outcome:string;passwordHints?:string[]}
export function gmailApiQuery(src:Source,search:Search,afterEpoch?:number):string {const q=gmailQuery(src,search);return afterEpoch===undefined?q:q.replace(/ newer_than:[^ ]+$/,` after:${afterEpoch}`);}
export function graphSearch(src:Source,search:Search,since?:string):string {return outlookQuery(src,search).replace('hasattachments:yes','hasattachments:true')+(since?` AND received>=${since}`:'');}
export function imapSearch(src:Source,since:string):string {
  const date=new Date(since.slice(0,10)+'T00:00:00Z'),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const senders=[...src.senders.addresses,...src.senders.domains];if(!senders.length)throw new Error('A sender is required for mail search');
  let expr=`FROM "${senders[0]}"`;for(const s of senders.slice(1))expr=`OR ${expr} FROM "${s}"`;
  return `UID SEARCH SINCE ${String(date.getUTCDate()).padStart(2,'0')}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()} ${expr}`;
}
export function senderAllowed(src:Source,from:string):boolean {
  const sender=from.toLowerCase(),dom=sender.split('@').at(-1)??'',matches=(d:string)=>dom===d.toLowerCase()||dom.endsWith('.'+d.toLowerCase());
  if(src.senders.excludeDomains.some(matches))return false;
  return src.senders.addresses.some(a=>a.toLowerCase()===sender)||src.senders.domains.some(matches);
}
export function routeFor(searchId:string):string {return ({alerts:'email.alert',statements:'pdf.statement',cas:'pdf.cas'} as Record<string,string>)[searchId]??'email.receipt';}
// Work in the timestamp's stated offset, rather than the host timezone or UTC date.
export function subtractDaysWithOffset(now:string,days:number):string {
  const offset=now.match(/(Z|[+-]\d\d:\d\d)$/)?.[1]??'Z',local=now.replace(/(Z|[+-]\d\d:\d\d)$/,'');
  return new Date(Date.parse(local+'Z')-days*86400000).toISOString().replace(/(?:\.000)?Z$/,'')+offset;
}
export function planQueries(picked:readonly SourceReference[],cursors:Readonly<Record<string,string>>,now?:string,provider:SyncProvider='gmail'):SyncQuery[] {
  if(provider!=='gmail'&&!now)throw new Error('First-run Graph/IMAP planning requires the sync start timestamp');
  return picked.flatMap(p=>{const src=sourceFor(p);return src.searches.map(search=>{const key=`${src.id}/${search.id}`,cur=cursors[key];
    if(provider==='gmail')return {key,q:gmailApiQuery(src,search,cur?Math.floor(Date.parse(cur)/1000):undefined)};
    const since=cur?.slice(0,10)??subtractDaysWithOffset(now!,365*parseInt(search.window,10)).slice(0,10);
    return {key,search:provider==='graph'?graphSearch(src,search,since):imapSearch(src,since)};
  });});
}
export function runSyncSimulation(mailbox:readonly SyntheticMessage[],picked:readonly SourceReference[],cursors:Readonly<Record<string,string>>,seen:ReadonlySet<string>|readonly string[],now:string,provider:SyncProvider='gmail') {
  const queries=planQueries(picked,cursors,now,provider),matched=new Map<string,string[]>(),nextCursors={...cursors},nextSeen=new Set(seen);
  for(const p of picked){const src=sourceFor(p);for(const se of src.searches){const key=`${src.id}/${se.id}`,cur=cursors[key];
    for(const m of mailbox){
      // This fake server mirrors the Python fixture's sender/token/attachment/date matching.
      if(!senderAllowed(src,m.from)||!se.subjectAny.some(t=>m.subject.toLowerCase().includes(t.replace(/^"|"$/g,'').toLowerCase()))||(se.attachment&&!m.attachments?.length)||(cur&&m.date<=cur))continue;
      matched.set(m.id,[...(matched.get(m.id)??[]),key]);
    }
    nextCursors[key]=subtractDaysWithOffset(now,1);
  }}
  const readLog:ReadLog[]=[];
  for(const m of [...mailbox].sort((a,b)=>a.date.localeCompare(b.date))){const keys=matched.get(m.id);if(!keys||nextSeen.has(m.id))continue;
    const route=routeFor(keys[0].split('/')[1]),outcome=route.startsWith('pdf.')?(m.attachments?.[0]?.encrypted?'awaitingPassword':'parsed'):route==='email.alert'?'parsed':'enrichOnly';
    readLog.push({messageId:m.id,date:m.date,from:m.from,subject:m.subject,matched:keys,route,outcome,...(outcome==='awaitingPassword'?{passwordHints:sourceFor(keys[0].split('/')[0]).passwordHints}:{})});nextSeen.add(m.id);
  }
  return {queries,fetched:readLog.map(l=>l.messageId),readLog,neverFetched:mailbox.filter(m=>!matched.has(m.id)).map(m=>m.id).sort(),cursors:nextCursors,seen:[...nextSeen]};
}
