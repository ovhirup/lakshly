import { catalog, sourceFor, type Source, type SourceReference } from './catalog';
import { detectProvider, type Provider, type MailProvider } from './links';
import { suggestBudget, goalFromSuggestion, addYears, type SetupDataset, type BudgetLine, type SetupGoal } from './suggest';
export const stepOrder = ['welcome','email','accounts','import','plan','done'] as const;
export type SetupStep = typeof stepOrder[number];
export type Platform = 'web'|'ios'|'macos';
export type SourceStatus = 'todo'|'searching'|'waiting'|'imported'|'skipped'|'error';
export interface SetupSource { catalogId:string; custom?:{name:string;domain?:string}; status:SourceStatus; skipReason?:string|null; lastDataDate?:string|null; importIds?:string[]; accountIds?:string[]; searchedAt?:string; accountDataDates?:Record<string,string> }
export interface PasswordTask { messageId:string; attachmentId:string; sourceId:string; since?:string }
export interface MailboxConsent { version:string;at:string;senders:number }
export interface SetupMailbox { id:string;provider:'google'|'microsoft'|'imap';address:string;method:'oauth'|'appPassword';imapHost?:string|null;connectedAt:string;lastSyncAt?:string|null;status:'ok'|'reauth'|'revoked'|'error';cursors:Record<string,string>;seenIds:string[];passwordTasks:PasswordTask[];consent?:MailboxConsent;progress?:{done:number;total:number};discovery?:{catalogId:string;count:number}[] }
export interface SetupEvent { event:'setup.completed';at:string;payload:{mode:'mine';required:string[];platform:Platform} }
export interface SetupImport { id:string;at:string;file:string;adapter:string;accountIds?:string[];added:number;duplicates:number }
export interface SetupState {
  v:1;startedAt:string;updatedAt:string;completedAt:string|null;dismissedAt:string|null;currentStep:SetupStep;stepsDone:SetupStep[];stepsSkipped:SetupStep[];
  profile:{name:string;currency:string};mode:'mine'|'demo';email:{primary:string;extra?:string[];provider:Provider;pickerProvider?:MailProvider;skipped:boolean};
  sources:SetupSource[];mailboxes?:SetupMailbox[];imports?:SetupImport[];events:SetupEvent[];appLock?:boolean;budgetMonths?:string[];goalIds?:string[];consent?:MailboxConsent;
}
type Context={dataset?:SetupDataset;platform?:Platform;today?:string;currentStep?:SetupStep};
export type SetupAction = Context & (
  | {type:'start'|'skipEmail'|'finishLater'|'dismissCard'|'reset'}
  | {type:'setProfile';profile:Partial<SetupState['profile']>}
  | {type:'chooseMode';mode:'mine'|'demo'}
  | {type:'setEmail';email:string;provider?:Provider;pickerProvider?:MailProvider}
  | {type:'addEmail'|'removeEmail';email:string}
  | {type:'consentGiven';consent?:MailboxConsent;senders?:number;mailboxId?:string}
  | {type:'mailboxConnected';mailbox:SetupMailbox}
  | {type:'discoveryDone';mailboxId:string;sources:{catalogId:string;count:number}[]}
  | {type:'syncStarted';mailboxId:string}
  | {type:'syncProgress';mailboxId:string;done:number;total:number;catalogId?:string;status?:SourceStatus}
  | {type:'syncDone';mailboxId:string;cursors?:Record<string,string>;seenIds?:string[]}
  | {type:'passwordTaskAdded';mailboxId:string;task:PasswordTask}
  | {type:'passwordTaskResolved';mailboxId:string;messageId:string;attachmentId?:string}
  | {type:'mailboxReauthNeeded'|'mailboxDisconnected';mailboxId:string}
  | {type:'toggleSource';catalogId:string}
  | {type:'addCustomSource';name:string;domain?:string;catalogId?:string}
  | {type:'searchTapped';catalogId:string}
  | {type:'importAttributed';adapter:string;catalogId?:string;importId?:string;file:string;accountIds:string[];added:number;duplicates:number;confidence?:number;lastDataDate?:string|null;accountDataDates?:Record<string,string>}
  | {type:'importFailed';catalogId:string;reason?:string}
  | {type:'setSourceStatus';catalogId:string;status:SourceStatus;reason?:string}
  | {type:'acceptBudget';lines?:BudgetLine[];factorPct?:number}
  | {type:'acceptGoal';goal?:SetupGoal}
  | {type:'skipStep'|'goTo';step:SetupStep;done?:boolean;from?:SetupStep}
);
export function initialSetup(now:string):SetupState {return {v:1,startedAt:now,updatedAt:now,completedAt:null,dismissedAt:null,currentStep:'welcome',stepsDone:[],stepsSkipped:[],profile:{name:'',currency:'INR'},mode:'mine',email:{primary:'',extra:[],provider:'other',skipped:false},sources:[],mailboxes:[],imports:[],events:[]};}
export function attribute(adapter:string,picked:readonly (string|SetupSource)[]) {
  const ids=picked.map(p=>typeof p==='string'?p:p.catalogId),hits=picked.filter(p=>sourceFor(p).importer.adapters.includes(adapter)).map(p=>typeof p==='string'?p:p.catalogId);
  return adapter.endsWith('.generic') ? {auto:null,ask:[...hits,...ids.filter(id=>!hits.includes(id))]} : {auto:hits.length===1?hits[0]:null,ask:hits.length===1?[]:hits};
}
export const requiredItems=['profile','myData','sources','firstImport','budget'];
export function checklist(state:SetupState,ds:SetupDataset,platform:Platform,today:string) {
  const picked=state.sources,kinds=new Set(picked.flatMap(p=>sourceFor(p).kinds));
  const imported=(ks:string[])=>picked.some(p=>p.status==='imported'&&sourceFor(p).kinds.some(k=>ks.includes(k)));
  const rows:[string,boolean,boolean][]=[['profile',true,!!state.profile.name.trim()&&!!state.profile.currency],['myData',true,state.mode==='mine'],['email',true,!!state.email.primary||state.email.skipped||!!state.mailboxes?.some(m=>m.status==='ok')],['sources',true,picked.length>0],['firstImport',true,imported(['bank','card'])],['investments',kinds.has('cas')||kinds.has('investment'),imported(['cas','investment'])],['allSources',picked.length>0,picked.every(p=>['imported','skipped'].includes(p.status))],['budget',true,(ds.budgets??[]).some(b=>b.month===today.slice(0,7))||!!state.budgetMonths?.includes(today.slice(0,7))],['goal',true,!!ds.goals?.length||!!state.goalIds?.length],['appLock',platform!=='web',!!state.appLock]];
  const items=rows.filter(([,app])=>app).map(([id,,done])=>({id,done,required:requiredItems.includes(id)})),done=items.filter(i=>i.done).length;
  return {items,done,applicable:items.length,percent:Math.floor(done*100/items.length),upAndRunning:items.every(i=>!i.required||i.done)};
}
export function freshnessNextDate(src:SetupSource,c= catalog):string|null {
  if (!src.lastDataDate) return null; const cad=c.sources.find(s=>s.id===src.catalogId)?.cadence??sourceFor(src).cadence;
  if(cad.every==='year')return addYears(src.lastDataDate);
  const d=new Date(src.lastDataDate+'T00:00:00Z');return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,cad.expectedDay??10)).toISOString().slice(0,10);
}
export function freshness(src:SetupSource,c: typeof catalog,today:string):'skipped'|'todo'|'fresh'|'due'|'stale' {
  if(src.status==='skipped')return 'skipped'; const next=freshnessNextDate(src,c);if(!next)return 'todo';if(today<=next)return 'fresh';
  const grace=c.sources.find(s=>s.id===src.catalogId)?.cadence.graceDays??10;
  return today<=new Date(new Date(next+'T00:00:00Z').getTime()+grace*86400000).toISOString().slice(0,10)?'due':'stale';
}
const uniq=<T>(a:T[])=>[...new Set(a)];
const emptySource=(catalogId:string):SetupSource=>({catalogId,status:'todo',lastDataDate:null,importIds:[],accountIds:[]});
export function setupReducer(state:SetupState,action:SetupAction,now:string):SetupState {
  if(action.type==='reset')return initialSetup(now);
  const s:SetupState=structuredClone(state);s.updatedAt=now;const today=action.today??now.slice(0,10),ds=action.dataset??{transactions:[]};
  const source=(id:string)=>s.sources.find(p=>p.catalogId===id),mb=('mailboxId' in action)?s.mailboxes?.find(m=>m.id===action.mailboxId):undefined;
  const mark=(step:SetupStep)=>{s.stepsDone=uniq([...s.stepsDone,step]);s.stepsSkipped=s.stepsSkipped.filter(x=>x!==step);};
  switch(action.type){
    case 'start':s.dismissedAt=null;break;
    case 'setProfile':s.profile={...s.profile,...action.profile,name:(action.profile.name??s.profile.name).slice(0,40)};break;
    case 'chooseMode':s.dismissedAt=null;s.mode=action.mode;mark('welcome');if(action.mode==='demo'){s.sources=[];s.currentStep='email';}break;
    case 'setEmail':{const email=action.email.trim().toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))break;s.email={...s.email,primary:email,provider:action.provider??detectProvider(email),pickerProvider:action.pickerProvider,extra:(s.email.extra??[]).filter(e=>e!==email),skipped:false};break;}
    case 'addEmail':{const email=action.email.trim().toLowerCase();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email!==s.email.primary)s.email.extra=uniq([...(s.email.extra??[]),email]);break;}
    case 'removeEmail':s.email.extra=(s.email.extra??[]).filter(x=>x!==action.email);break;
    case 'skipEmail':s.email.skipped=true;mark('email');break;
    case 'consentGiven':s.consent=action.consent??{version:'mailsync-consent-v1',at:now,senders:action.senders??0};if(mb)mb.consent=s.consent;break;
    case 'mailboxConnected':s.mailboxes=[...(s.mailboxes??[]).filter(m=>m.id!==action.mailbox.id),{...action.mailbox,consent:action.mailbox.consent??s.consent}];s.email.skipped=false;break;
    case 'discoveryDone':if(mb)mb.discovery=action.sources;for(const found of action.sources)if(found.count>0&&!source(found.catalogId)&&s.mode==='mine')s.sources.push(emptySource(found.catalogId));break;
    case 'syncStarted':if(mb&&mb.status==='ok'){mb.progress={done:0,total:0};s.sources.forEach(p=>{if(p.status!=='skipped')p.status='searching';});}break;
    case 'syncProgress':if(mb)mb.progress={done:action.done,total:action.total};if(action.catalogId&&action.status){const p=source(action.catalogId);if(p)p.status=action.status;}break;
    case 'syncDone':if(mb&&mb.status==='ok'){mb.lastSyncAt=now;mb.cursors=action.cursors??mb.cursors;mb.seenIds=uniq(action.seenIds??mb.seenIds).slice(-5000);delete mb.progress;}break;
    case 'passwordTaskAdded':if(mb){mb.passwordTasks=[...mb.passwordTasks.filter(t=>t.messageId!==action.task.messageId||t.attachmentId!==action.task.attachmentId),action.task];const p=source(action.task.sourceId);if(p)p.status='waiting';}break;
    case 'passwordTaskResolved':if(mb)mb.passwordTasks=mb.passwordTasks.filter(t=>t.messageId!==action.messageId||(action.attachmentId!==undefined&&t.attachmentId!==action.attachmentId));break;
    case 'mailboxReauthNeeded':if(mb)mb.status='reauth';break;
    case 'mailboxDisconnected':s.mailboxes=(s.mailboxes??[]).filter(m=>m.id!==action.mailboxId);break;
    case 'toggleSource':if(s.mode==='mine'){const p=source(action.catalogId);s.sources=p?s.sources.filter(x=>x!==p):[...s.sources,emptySource(action.catalogId)];}break;
    case 'addCustomSource':if(s.mode==='mine'){const id=action.catalogId??`custom:${action.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;if(!source(id))s.sources.push({...emptySource(id),custom:{name:action.name,domain:action.domain?.trim().toLowerCase()}});}break;
    case 'searchTapped':{const p=source(action.catalogId);if(p){p.searchedAt=now;if(p.status==='todo')p.status='searching';}break;}
    case 'importAttributed':{
      const remembered=s.sources.find(p=>action.accountIds.some(id=>p.accountIds?.includes(id)))?.catalogId;
      const id=action.catalogId??remembered??attribute(action.adapter,s.sources).auto,p=id?source(id):undefined;
      if(!p)break;const importId=action.importId??`imp_${((s.imports?.length??0)+1).toString().padStart(3,'0')}`;
      p.status=action.confidence!==undefined&&action.confidence<0.6?'error':'imported';p.skipReason=p.status==='error'?'Low-confidence layout; check the imported rows':null;p.accountIds=uniq([...(p.accountIds??[]),...action.accountIds]);p.importIds=uniq([...(p.importIds??[]),importId]);
      if(action.accountDataDates){p.accountDataDates={...p.accountDataDates,...action.accountDataDates};p.lastDataDate=Object.values(p.accountDataDates).sort()[0];}
      else if(action.lastDataDate)p.lastDataDate=action.lastDataDate;
      s.imports=[...(s.imports??[]).filter(i=>i.id!==importId),{id:importId,at:now,file:action.file,adapter:action.adapter,accountIds:action.accountIds,added:action.added,duplicates:action.duplicates}];break;}
    case 'importFailed':{const p=source(action.catalogId);if(p){p.status='error';p.skipReason=action.reason;}break;}
    case 'setSourceStatus':{const p=source(action.catalogId);if(p){p.status=action.status;p.skipReason=action.reason;}break;}
    case 'acceptBudget':{const lines=action.lines??suggestBudget(ds,today,action.factorPct).lines;s.budgetMonths=uniq([...(s.budgetMonths??[]),...lines.map(l=>l.month)]);break;}
    case 'acceptGoal':{const goal=action.goal??goalFromSuggestion(ds,today,now);if(goal&&!(ds.goals??[]).some(g=>g.id!==goal.id)&&!(s.goalIds??[]).some(id=>id!==goal.id))s.goalIds=[goal.id];break;}
    case 'skipStep':s.stepsSkipped=uniq([...s.stepsSkipped,action.step]);s.stepsDone=s.stepsDone.filter(x=>x!==action.step);break;
    case 'goTo':if(action.done)mark(action.from??s.currentStep);s.currentStep=action.step;break;
    case 'finishLater':s.dismissedAt=null;break;
    case 'dismissCard':s.dismissedAt=now;break;
  }
  if(!['goTo','finishLater','dismissCard'].includes(action.type))s.currentStep=stepOrder.find(step=>!s.stepsDone.includes(step)&&!s.stepsSkipped.includes(step))??'done';
  if(action.currentStep)s.currentStep=action.currentStep;
  const c=checklist(s,ds,action.platform??'web',today);
  if(c.upAndRunning&&s.mode==='mine'&&!s.events.some(e=>e.event==='setup.completed')&&!s.completedAt){s.events.push({event:'setup.completed',at:now,payload:{mode:'mine',required:[...requiredItems],platform:action.platform??'web'}});s.completedAt=now;}
  return s;
}
export type { Source, SourceReference };
