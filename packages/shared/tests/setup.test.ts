import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { catalog,sourceFor,gmailQuery,outlookQuery,gmailUrl,outlookOpenUrl,detectProvider,detectPickerProvider,plainSearch,suggestBudget,suggestGoal,goalFromSuggestion,checklist,freshness,attribute,setupReducer,initialSetup,gmailApiQuery,graphSearch,imapSearch,senderAllowed,planQueries,runSyncSimulation,subtractDaysWithOffset,type SetupState,type SetupAction,type SetupDataset } from '../index';
import ds from '../setup/__fixtures__/dataset.after-import.json';
import fixture from '../setup/__fixtures__/state.midway.json';
import expected from '../setup/__fixtures__/expected.json';
import mailbox from '../setup/__fixtures__/mailbox.synthetic.json';
const today=expected.now.slice(0,10),state=fixture as unknown as SetupState;
describe('reference golden outputs',()=>{
  it('provider and inbox URLs',()=>{for(const [e,p]of Object.entries(expected.provider))expect(detectProvider(e)).toBe(p);for(const [e,url]of Object.entries(expected.outlookOpenUrl))expect(outlookOpenUrl(e)).toBe(url);expect(gmailUrl('','from:netflix.com')).toBe(expected.gmailUrlNoEmail);});
  for(const link of expected.links)it(`byte-for-byte ${link.source}/${link.search}`,()=>{const src=sourceFor(link.source),search=src.searches.find(s=>s.id===link.search)!;expect(gmailQuery(src,search)).toBe(link.gmailQuery);expect(gmailUrl(state.email.primary,gmailQuery(src,search))).toBe(link.gmailUrl);expect(outlookQuery(src,search)).toBe(link.outlookQuery);});
  it('budget integer paise, ranking, rounding and ignored tags',()=>expect(suggestBudget(ds,today)).toEqual(expected.budget));
  it('goal annual payment',()=>expect(suggestGoal(ds,today)).toEqual(expected.goal));
  it('goal low cash',()=>{const low=structuredClone(ds);low.accounts[0].balance=4000000;expect(suggestGoal(low,today)).toEqual(expected.goalIfLowCash);});
  it('starter without complete month',()=>expect(suggestBudget({transactions:ds.transactions.filter(t=>t.date>='2026-09-10')},today).mode).toBe(expected.budgetStarterWhenNoCompleteMonth));
  it('freshness at now',()=>expect(Object.fromEntries(state.sources.map(p=>[p.catalogId,freshness(p,catalog,today)]))).toEqual(expected.freshnessAtNow));
  it('checklist before web and Apple',()=>{expect(checklist(state,ds,'web',today)).toEqual(expected.checklistBefore.web);expect(checklist(state,ds,'ios',today)).toEqual(expected.checklistBefore.ios);expect(checklist(state,ds,'macos',today)).toEqual(expected.checklistBefore.ios);});
  it('replays session; completion exactly once at budget accept 11:10',()=>{
    let s=structuredClone(state);const data:SetupDataset={...structuredClone(ds),goals:[]};
    for(const raw of fixture.session.actions){const action={...raw,dataset:data,today,platform:'web'} as SetupAction;s=setupReducer(s,action,raw.at);
      if(action.type==='acceptBudget')data.budgets=suggestBudget(data,today,action.factorPct).lines.map(({id,month,category,limit,rollover})=>({id,month,category,limit,rollover}));
      if(action.type==='acceptGoal'){const g=goalFromSuggestion(data,today,raw.at)!;data.goals=[g];expect(data.goals).toEqual(expected.goalsAfter);}
    }
    expect(checklist(s,data,'web',today)).toEqual(expected.checklistAfter.web);expect(checklist(s,data,'ios',today)).toEqual(expected.checklistAfter.ios);
    expect(s.events).toEqual(expected.events);expect(s.completedAt).toBe(expected.completedAt);
    expect(setupReducer(s,{type:'start',dataset:data},'2026-10-03T11:15:00+05:30').events).toEqual(expected.events);
    expect(state.sources[2].status).toBe('todo');
  });
  for(const [description,value]of Object.entries(expected.attribution))it(`attribution ${description}`,()=>{const [adapter,ids]=description.split(' with ');expect(attribute(adapter,ids.slice(1,-1).split(', '))).toEqual(value);});
});
describe('pure sync mock harness',()=>{
  it('preserves fractional cursor timestamps and offset',()=>{expect(subtractDaysWithOffset('2026-10-03T11:20:00.123+05:30',1)).toBe('2026-10-02T11:20:00.123+05:30');expect(subtractDaysWithOffset('2026-10-03T11:20:00.123Z',1)).toBe('2026-10-02T11:20:00.123Z');});
  it('first, second and graph runs reproduce reference; input cursors/seen untouched',()=>{
    const cursors={},seen=new Set<string>();const first=runSyncSimulation(mailbox.first,mailbox.picked,cursors,seen,mailbox.firstSyncAt);
    const {cursors:next,seen:seenNext,...golden}=first;expect(golden).toEqual(expected.sync.first);expect(next).toEqual(expected.sync.cursorsAfterFirst);expect(cursors).toEqual({});expect(seen.size).toBe(0);
    const second=runSyncSimulation([...mailbox.first,...mailbox.second],mailbox.picked,next,seenNext,mailbox.secondSyncAt);
    expect({queries:second.queries,fetched:second.fetched,readLog:second.readLog}).toEqual(expected.sync.second);
    expect(second.neverFetched).toContain('msg_p002');expect(second.fetched).not.toContain('msg_a002');
    expect(runSyncSimulation(mailbox.first,['hdfc-bank'],{},[],mailbox.firstSyncAt,'graph').queries).toEqual(expected.sync.graphFirstQueriesHdfcBank);
  });
  it('graph and IMAP golden strings',()=>{const src=sourceFor('hdfc-bank'),search=src.searches[0];expect(graphSearch(src,search,'2026-10-02')).toBe(expected.sync.graphIncrementalExample);expect(imapSearch(src,'2026-10-02')).toBe(expected.sync.imapExample.generic);expect(`UID SEARCH X-GM-RAW "${gmailApiQuery(src,search,1790920200)}"`).toBe(expected.sync.imapExample.gmailXGmRaw);});
  it('exclusions win; suffix impostors rejected; explicit addresses are case insensitive',()=>{const src=sourceFor('hdfc-bank');expect(senderAllowed(src,'alerts@HDFCBANK.NET')).toBe(true);expect(senderAllowed(src,'information@mailers.hdfcbank.bank.in')).toBe(false);expect(senderAllowed(src,'alerts@evilhdfcbank.net')).toBe(false);expect(senderAllowed(sourceFor('cdsl-cas'),'ECAS@CDSLSTATEMENT.COM')).toBe(true);});
  it('planner only plans picked sources and refuses undated first Graph run',()=>{expect(planQueries(['hdfc-bank'],{})).toHaveLength(2);expect(()=>planQueries(['hdfc-bank'],{},undefined,'graph')).toThrow();});
});
describe('catalog and synthetic guards',()=>{
  it('matching rules contain no secret values, unique ids, valid hints and senders',()=>{
    expect(JSON.stringify(catalog)).not.toMatch(/password\s*[:=]|\b[A-Z]{5}\d{4}[A-Z]\b/);expect(new Set(catalog.sources.map(s=>s.id)).size).toBe(catalog.sources.length);
    for(const src of catalog.sources){expect(src.senders.domains.length+src.senders.addresses.length).toBeGreaterThan(0);for(const key of src.passwordHints)expect(key in catalog.passwordHintFormats).toBe(true);}
    for(const kind of catalog.kindOrder){const regions=catalog.sources.filter(s=>s.kinds.includes(kind)).map(s=>s.region);const firstGlobal=regions.indexOf('GLOBAL');if(firstGlobal>=0)expect(regions.slice(firstGlobal)).not.toContain('IN');}
    console.warn('Unverified setup sources:',catalog.sources.filter(s=>!s.verified).map(s=>s.id).join(', '));
  });
  it('all four fixtures are SYNTHETIC',()=>{for(const file of ['dataset.after-import.json','state.midway.json','mailbox.synthetic.json','expected.json'])expect(readFileSync(new URL(`../setup/__fixtures__/${file}`,import.meta.url),'utf8')).toContain('SYNTHETIC');});
  it('depository support leaves queries identical',()=>{for(const id of ['cdsl-cas','nsdl-cas'])expect(sourceFor(id).importer).toEqual({formats:['pdf'],adapters:['cas.depository'],supported:true});});
});
describe('reducer actions',()=>{
  it('attributes low-confidence identity atomically without false completion',()=>{let s=setupReducer(initialSetup(expected.now),{type:'setProfile',profile:{name:'SYNTHETIC Demo'}},expected.now);s=setupReducer(s,{type:'toggleSource',catalogId:'hdfc-bank'},expected.now);s=setupReducer(s,{type:'importAttributed',adapter:'bank.hdfc',file:'SYNTHETIC.pdf',accountIds:['acc_demo001'],added:1,duplicates:0,confidence:0.5,dataset:{transactions:[],budgets:[{month:'2026-10'}]}},expected.now);expect(s.sources[0].status).toBe('error');expect(s.events).toEqual([]);expect(s.completedAt).toBe(null);});
  it('keeps an explicitly navigated screen through edits and Finish later',()=>{let s=setupReducer(state,{type:'setProfile',profile:{name:'SYNTHETIC Demo'},currentStep:'email'},expected.now);expect(s.currentStep).toBe('email');s=setupReducer(s,{type:'finishLater',currentStep:'email'},expected.now);expect(s.currentStep).toBe('email');expect(s.dismissedAt).toBe(null);});
  it('marks the displayed deep-link step when continuing',()=>{const s=setupReducer(state,{type:'goTo',step:'accounts',from:'email',done:true},expected.now);expect(s.stepsDone).toContain('email');expect(s.stepsDone).not.toContain('import');});
  const now='2026-10-03T11:00:00+05:30';
  it('profile, manual mail, steps, source choices, demo and reset',()=>{
    let s=initialSetup(now);const apply=(a:SetupAction)=>{s=setupReducer(s,a,now);};
    apply({type:'setProfile',profile:{name:'x'.repeat(50)}});expect(s.profile.name).toHaveLength(40);apply({type:'chooseMode',mode:'mine'});expect(s.currentStep).toBe('email');
    apply({type:'setEmail',email:' DEMO@EXAMPLE.ORG '});expect(s.email.primary).toBe('demo@example.org');apply({type:'setEmail',email:'bad'});expect(s.email.primary).toBe('demo@example.org');
    apply({type:'addEmail',email:' extra@example.org '});apply({type:'addEmail',email:'extra@example.org'});expect(s.email.extra).toEqual(['extra@example.org']);apply({type:'removeEmail',email:'extra@example.org'});expect(s.email.extra).toEqual([]);
    apply({type:'toggleSource',catalogId:'hdfc-bank'});apply({type:'toggleSource',catalogId:'hdfc-bank'});expect(s.sources).toEqual([]);apply({type:'addCustomSource',name:'Example Co-op',domain:'MAIL.EXAMPLE.ORG'});expect(sourceFor(s.sources[0]).senders.domains).toEqual(['mail.example.org']);
    apply({type:'searchTapped',catalogId:s.sources[0].catalogId});expect(s.sources[0].status).toBe('searching');apply({type:'importFailed',catalogId:s.sources[0].catalogId});expect(s.sources[0].status).toBe('error');
    apply({type:'skipEmail'});expect(s.email.skipped).toBe(true);apply({type:'skipStep',step:'accounts'});expect(s.currentStep).toBe('import');apply({type:'goTo',step:'plan',done:true});expect(s.currentStep).toBe('plan');expect(s.stepsDone).toContain('import');apply({type:'finishLater'});expect(s.dismissedAt).toBe(null);expect(s.currentStep).toBe('plan');apply({type:'dismissCard'});expect(s.dismissedAt).toBe(now);
    apply({type:'chooseMode',mode:'demo'});apply({type:'toggleSource',catalogId:'hdfc-bank'});expect(s.sources).toEqual([]);expect(s.events).toEqual([]);apply({type:'reset'});expect(s).toEqual(initialSetup(now));
  });
  it('mailbox lifecycle, consent, discovery, progress, tasks, disconnect clears mailbox state',()=>{
    let s=initialSetup(now);const apply=(a:SetupAction)=>{s=setupReducer(s,a,now);};
    apply({type:'consentGiven',senders:4});apply({type:'mailboxConnected',mailbox:{id:'mbx_demo',provider:'google',address:'demo@example.org',method:'oauth',connectedAt:now,status:'ok',cursors:{},seenIds:[],passwordTasks:[]}});expect(s.mailboxes![0].consent).toEqual({version:'mailsync-consent-v1',at:now,senders:4});
    apply({type:'discoveryDone',mailboxId:'mbx_demo',sources:[{catalogId:'hdfc-bank',count:2},{catalogId:'netflix',count:0}]});expect(s.sources.map(p=>p.catalogId)).toEqual(['hdfc-bank']);apply({type:'syncStarted',mailboxId:'mbx_demo'});expect(s.sources[0].status).toBe('searching');apply({type:'syncProgress',mailboxId:'mbx_demo',done:1,total:2});expect(s.mailboxes![0].progress).toEqual({done:1,total:2});
    apply({type:'passwordTaskAdded',mailboxId:'mbx_demo',task:{messageId:'msg_demo',attachmentId:'att_demo',sourceId:'hdfc-bank'}});expect(s.sources[0].status).toBe('waiting');apply({type:'passwordTaskResolved',mailboxId:'mbx_demo',messageId:'msg_demo'});expect(s.mailboxes![0].passwordTasks).toEqual([]);apply({type:'syncDone',mailboxId:'mbx_demo',cursors:{'hdfc-bank/alerts':now},seenIds:['msg_demo']});expect(s.mailboxes![0].lastSyncAt).toBe(now);expect(s.mailboxes![0].progress).toBeUndefined();apply({type:'mailboxReauthNeeded',mailboxId:'mbx_demo'});expect(s.mailboxes![0].status).toBe('reauth');apply({type:'mailboxDisconnected',mailboxId:'mbx_demo'});expect(s.mailboxes).toEqual([]);
  });
  it('remembered attribution, no generic auto attribute and oldest account data freshness',()=>{
    let s=structuredClone(state);s=setupReducer(s,{type:'importAttributed',adapter:'bank.generic',file:'synthetic.pdf',accountIds:['acc_sav001','acc_sav002'],added:0,duplicates:3,importId:'imp_demo',accountDataDates:{acc_sav001:'2026-10-02',acc_sav002:'2026-09-30'}},now);expect(s.sources[0].importIds).toContain('imp_demo');expect(s.sources[0].lastDataDate).toBe('2026-09-30');expect(attribute('bank.generic',['hdfc-bank','kotak-bank']).auto).toBe(null);
  });
  it('all six picker providers and non-Gmail copy',()=>{for(const [email,provider]of [['demo@gmail.com','google'],['demo@outlook.in','microsoft'],['demo@me.com','icloud'],['demo@yahoo.in','yahoo'],['demo@zoho.in','zoho'],['demo@example.org','other']])expect(detectPickerProvider(email)).toBe(provider);const src=sourceFor('hdfc-bank');expect(plainSearch(src,src.searches[1])).toContain("with 'statement' in the subject");});
});
