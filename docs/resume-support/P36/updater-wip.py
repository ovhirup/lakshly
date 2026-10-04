from pathlib import Path
import copy, difflib, hashlib, json, re, subprocess

OLD='2d79390e04196acc98ac67eb3be27004bcd64914'
NEW='779f9130e80adce66a1825212756d5f0acc8e677'
ROOT=Path('/Users/abhirupbanerjee/Documents/ChatGPT/Lakshly/repo')
manifest=json.loads(Path('/private/tmp/lakshly-P36-original-scope.json').read_text())
for item in manifest['paths']:
    assert hashlib.sha256((ROOT/item['path']).read_bytes()).hexdigest()==item['sha256'], item['path']
cache={}
def source(ref,path):
    key=(ref,path)
    if key not in cache:
        cache[key]=subprocess.check_output(['git','show',ref+':'+path],cwd=ROOT,text=True).splitlines()
    return cache[key]
def anchor(path,line):
    value=source(NEW,path)[line-1].strip()
    assert value, (path,line)
    return {'path':path,'line':line,'needle':value}
def moved(path,line):
    if source(OLD,path)==source(NEW,path): return line
    for tag,i,j,a,b in difflib.SequenceMatcher(None,source(OLD,path),source(NEW,path),autojunk=False).get_opcodes():
        if tag=='equal' and i<=line-1<j: return a+(line-1-i)+1
    old=source(OLD,path)[line-1]
    matches=[i+1 for i,s in enumerate(source(NEW,path)) if s==old]
    assert len(matches)==1, ('No unambiguous preserved citation',path,line,old)
    return matches[0]
def reanchor(text):
    regex=r'\b(apps/web/[^\s`\"\'<>():]+):([0-9]+)\b'
    return re.sub(regex,lambda m:m[1]+':'+str(moved(m[1],int(m[2]))),text)
def evidence_move(value):
    for a in value:
        if not a['path'].startswith('apps/web/'): continue
        new_line=moved(a['path'],a['line'])
        assert a['needle'] in source(NEW,a['path'])[new_line-1],a
        a['line']=new_line

p=json.loads((ROOT/'docs/public-feature-catalog.proposal.json').read_text())
before=copy.deepcopy(p)
p['sourceCommit']=NEW
for f in p['features']:
    # Replaced observations below have deliberately changed implementation lines.
    if f['id'] in {'security.lock','security.encryption','data.export','setup.freshnessReminders','history.full','data.delete','review.reminder','review.worthIt','mailSync.connect'}: continue
    w=f['platforms']['web']
    w['notes']=reanchor(w['notes'])
    evidence_move(w['evidence'])
features={f['id']:f for f in p['features']}
def review(id,notes,locations,status=None):
    w=features[id]['platforms']['web']
    w['notes']=notes
    w['evidence']=[anchor(path,line) for path,line in locations]
    if status: w['sourceStatus']=status
    if id in {'data.export','setup.freshnessReminders'}:
        for r in w['releaseProposal'].values():
            r['suggestion']='evidenceReviewCandidate'
            r['rationale']='Concrete source exists only within the qualified scope in this observation; runtime, security, purchase/device and channel release evidence still require review.'

review('security.lock','Partial imported-vault lock: `apps/web/components/VaultLock.tsx:43` describes passphrase-wrapped imported data; enabling and locking are implemented at `apps/web/lib/vault.ts:77` and `apps/web/lib/vault.ts:98`. `apps/web/components/DataState.tsx:79` clears loaded imported UserData, while `apps/web/components/DataState.tsx:170` permits demo before the locked gate at `apps/web/components/DataState.tsx:171`. Demo, profile and navigation remain accessible. Whole-app locking, clearing already-loaded sensitive Setup/Review/Game provider state, atomic migration/recovery and security readiness are not established. Retain partial/hold under the declared App lock label.',[('apps/web/components/VaultLock.tsx',43),('apps/web/lib/vault.ts',77),('apps/web/lib/vault.ts',98),('apps/web/components/DataState.tsx',79),('apps/web/components/DataState.tsx',170),('apps/web/components/DataState.tsx',171)],'sourcePartial')
review('security.encryption','Implemented cryptographic source: `apps/web/lib/vault.ts:23` holds an unlocked session key; the default nonextractable key is at `apps/web/lib/vault.ts:108`, dataset AES-GCM encryption at `apps/web/lib/vault.ts:116`, and record encryption at `apps/web/lib/vault.ts:133`. Optional passphrase wrapping uses PBKDF2/SHA256 at `apps/web/lib/vault-lock.ts:26`, wrapping at `apps/web/lib/vault-lock.ts:38` and nonextractable unwrapping at `apps/web/lib/vault-lock.ts:47`. The origin-code limitation remains at `apps/web/lib/vault.ts:5`. Enabling lock reencrypts sequentially at `apps/web/lib/vault.ts:64`, stores the lock at `apps/web/lib/vault.ts:84` and deletes the key in a separate transaction at `apps/web/lib/vault.ts:85`; atomic migration/recovery and all-sensitive-memory protection are not established. Cryptographic source presence is not an audited security guarantee.',[('apps/web/lib/vault.ts',108),('apps/web/lib/vault.ts',116),('apps/web/lib/vault.ts',133),('apps/web/lib/vault-lock.ts',26),('apps/web/lib/vault.ts',5)])
review('data.export','Implemented for the active books: gated profile action at `apps/web/app/profile/page.tsx:146` downloads dataset JSON at `apps/web/app/profile/page.tsx:151` and transactions CSV at `apps/web/app/profile/page.tsx:152`; browser save is at `apps/web/app/profile/page.tsx:57`. Exporters at `apps/web/lib/export.ts:4` and `apps/web/lib/export.ts:15` serialize the active dataset and transaction rows with paise, including demo when active. This is not a complete vault/UserData backup: separately stored holdings, statement metadata, import logs, goals/profile/review/game records are not included by datasetJson(dataset). Restoration round-trip UI/runtime behavior is not established.',[('apps/web/lib/export.ts',4),('apps/web/lib/export.ts',15),('apps/web/app/profile/page.tsx',146),('apps/web/app/profile/page.tsx',151),('apps/web/app/profile/page.tsx',152)],'sourceImplemented')
review('setup.freshnessReminders','Implemented Premium in-app cadence notice: gate and due selection at `apps/web/components/FreshnessReminder.tsx:43` and `apps/web/components/FreshnessReminder.tsx:44`, with selection helper at `apps/web/lib/setup.ts:335`. Mounted through `apps/web/components/TodayCard.tsx:36` on Overview at `apps/web/app/page.tsx:36`. Seven-day Not now snooze is at `apps/web/components/FreshnessReminder.tsx:74`; optional foreground check at `apps/web/components/FreshnessReminder.tsx:66` uses an already connected Gmail tab. No push/background scheduler, new mailbox authority, notification delivery, or runtime release readiness is established.',[('apps/web/components/FreshnessReminder.tsx',43),('apps/web/components/FreshnessReminder.tsx',44),('apps/web/lib/setup.ts',335),('apps/web/components/TodayCard.tsx',36)],'sourceImplemented')
review('history.full','Partial chart allowance: `apps/web/app/history/page.tsx:18` reads the limit and `apps/web/app/history/page.tsx:23` slices only returned net-worth chart points. `apps/web/lib/selectors.ts:55` computes that history from transaction-month keys iterated at `apps/web/lib/selectors.ts:66`; the observed unit is last N returned transaction-month points, not guaranteed trailing N calendar months. Savings balance history at `apps/web/app/history/page.tsx:20` and cashflow at `apps/web/app/history/page.tsx:21` still use all transactions. No general history window or retention cap is established; imported history is not deleted by this code.',[('apps/web/app/history/page.tsx',18),('apps/web/app/history/page.tsx',23),('apps/web/app/history/page.tsx',20),('apps/web/app/history/page.tsx',21)])
review('data.delete','Implemented deletion source with blocked-delete caveat: `apps/web/lib/vault.ts:153` defines deletion, but `apps/web/lib/vault.ts:157` resolves on blocked deletion. Provider clearing/deletion calls are at `apps/web/components/DataState.tsx:137` and `apps/web/components/DataState.tsx:138`; import confirmation remains at `apps/web/components/Import.tsx:57`. Guaranteed erasure and lock/session-key interactions are not independently verified.',[('apps/web/lib/vault.ts',153),('apps/web/lib/vault.ts',157),('apps/web/components/DataState.tsx',137)])
review('review.reminder','Implemented in-app Sunday review: `apps/web/lib/review.ts:203` defines the stored preference with default-on unless false at `apps/web/lib/review.ts:204`. `apps/web/lib/review.ts:214` and `apps/web/lib/review.ts:215` require local Sunday, pending inbox items, enabled preference and no snooze, without an evening-hour restriction. The gate is at `apps/web/components/ReviewParts.tsx:75`, seven-day snooze at `apps/web/components/ReviewParts.tsx:67`, and Today rendering at `apps/web/components/TodayCard.tsx:19`. No push/notification delivery or runtime verification.',[('apps/web/lib/review.ts',203),('apps/web/lib/review.ts',215),('apps/web/components/ReviewParts.tsx',75),('apps/web/components/TodayCard.tsx',19)])
review('review.worthIt','Implemented rating feature: thumbs UI at `apps/web/app/review/page.tsx:33`, rating action at `apps/web/lib/review.ts:296` and ratio computation at `apps/web/lib/review.ts:392`; WorthItCard is at `apps/web/components/ReviewParts.tsx:126`. The newer three-day wait quest at `apps/web/components/ReviewParts.tsx:158` is separate from the rating entitlement; other quest kinds remain coming soon at `apps/web/components/ReviewParts.tsx:161`.',[('apps/web/app/review/page.tsx',33),('apps/web/lib/review.ts',296),('apps/web/components/ReviewParts.tsx',126)])
features['credit.insights']['platforms']['web']['notes']+=' Premium in-app card-payment reminder consumes this existing gate at `apps/web/components/CardDueReminder.tsx:47`; due filtering is at `apps/web/components/CardDueReminder.tsx:54` and seven-day snooze at `apps/web/components/CardDueReminder.tsx:71`. The window is zero through three days under `apps/web/lib/card-due.ts:3`. No payment execution, push or runtime delivery assurance.'
features['credit.insights']['platforms']['web']['evidence'].append(anchor('apps/web/components/CardDueReminder.tsx',47))
review('mailSync.connect','Partial foreground/manual read-only Gmail search/import: `apps/web/components/GoogleConnect.tsx:101` connects and `apps/web/components/GoogleConnect.tsx:178` searches. Same-tab checking at `apps/web/components/GoogleConnect.tsx:156` requires an existing token/client at `apps/web/components/GoogleConnect.tsx:157`; disconnect clears memory/revokes at `apps/web/components/GoogleConnect.tsx:144` and closes consent at `apps/web/components/GoogleConnect.tsx:239`. Availability at `apps/web/lib/edition.ts:18` is Beta or an explicit flag. No connected-mailbox count guard, automatic/background sync, verified billing or private authority is established.',[('apps/web/components/GoogleConnect.tsx',101),('apps/web/components/GoogleConnect.tsx',178),('apps/web/components/GoogleConnect.tsx',156),('apps/web/lib/edition.ts',18)])
features['themes.premium']['platforms']['web']['notes']+=' The newer glass slider at `apps/web/components/ThemeV2.tsx:141` is a separate local preference with reduced-transparency disabling at `apps/web/components/ThemeV2.tsx:152`; no Premium entitlement rule is demonstrated for that slider.'
features['core.tabs']['platforms']['web']['notes']+=' New Owed and Ask navigation entries at `apps/web/components/Shell.tsx:27` and `apps/web/components/Shell.tsx:32` have no matching shared catalog IDs. TodayCard is a composition surface rather than an OS widget.'
features['budgets.unlimited']['platforms']['web']['notes']+=' Repeating monthly plan selection at `apps/web/lib/selectors.ts:219` uses an existing monthly set until changed; it does not resolve one-budget grouping/count semantics or enforce a count.'

for q in p['quotaReviews']:
    w=q['platformObservations']['web']
    if q['id']=='history.full':
        w.update(observedUnit='Last returned transaction-month points for the net-worth chart only.',enforcement='sourceUIOnly',notes=features['history.full']['platforms']['web']['notes'],evidence=copy.deepcopy(features['history.full']['platforms']['web']['evidence']))
    else:
        w['notes']=reanchor(w['notes'])
        evidence_move(w['evidence'])
        if q['id']=='budgets.unlimited': w['notes']+=' Monthly plans repeat via `apps/web/lib/selectors.ts:219`; no budget-count guard is established.'

def immutable(p):
    return {
        'metadata':{k:p[k] for k in ('proposalVersion','kind','status','runtimeEvidence','privateSuiteEvidence','legacyCatalog','policyReferences')},
        'rights':p['freeBillOfRights'],
        'features':[{k:f[k] for k in ('id','legacy','freeRight')}|{'iphone':f['platforms']['iphone'],'macos':f['platforms']['macos']} for f in p['features']],
        'aliases':p['appleAliases'],
        'quotas':[{k:q[k] for k in ('id','legacyLimits','proposedUnit','migrationHazard','decisionIds')}|{'iphone':q['platformObservations']['iphone'],'macos':q['platformObservations']['macos']} for q in p['quotaReviews']],
        'decisions':p['ownerDecisions']}
assert immutable(before)==immutable(p)
assert [(f['id'],f['platforms']['web']['sourceStatus']) for f,b in zip(p['features'],before['features']) if f['platforms']['web']['sourceStatus']!=b['platforms']['web']['sourceStatus']]==[('security.lock','sourcePartial'),('data.export','sourceImplemented'),('setup.freshnessReminders','sourceImplemented')]
(ROOT/'docs/public-feature-catalog.proposal.json').write_text(json.dumps(p,indent=2)+'\n')

public=ROOT/'docs/PUBLIC-FEATURE-CATALOG.md'
s=public.read_text().replace(OLD,NEW)
s=s.replace('It changes no app, helper, shared catalog, feature policy, or release eligibility.', 'This refresh moves the evidence snapshot from `2d79390` to `779f913` after a bounded\nWeb delta audit. Apple sources and the shared legacy catalog/schema are unchanged\nbetween those pins. The proposal branch was not merged or rebased to newer app\nsource. It changes no app, helper, shared catalog, feature policy, or release eligibility.')
s=s.replace('state were not inspected. Unmerged Cursor drafts are outside this pinned inventory.', 'state were not inspected. Source merged at the new pin is included; later or\nunmerged work remains outside this fixed inventory.')
s=s.replace('Web lock is planned/stubbed; dataset export was not found on any audited platform;\nWeb mailbox sync is only partial foreground, read-only Gmail, while Apple connectors\nremain inactive.', 'Web now has partial imported-vault locking, with demo/profile/navigation still\naccessible. Active-dataset JSON and transaction CSV export exist on Web; broader\nvault/UserData backup and restoration are not established. Dataset export remains\nnot found in the bounded native audit. Web mailbox sync is partial foreground,\nread-only Gmail, while Apple connectors remain inactive.')
s=s.replace('web: Free 12/Premium unlimited text exists, but all transactions feed history without display or retention cap.', 'web: The net-worth chart slices the last returned transaction-month points to the allowance. This is not a guaranteed trailing calendar window; balance and cashflow views still use all transactions, and no retention cap or deletion is established.')
s=s.replace('web: Month/category lines are retained across months; no budget-count limit consumer or save guard was found.', 'web: Month/category lines are retained and monthly plans repeat until changed; no budget-count limit consumer or save guard was found. Grouping/count semantics remain pending.')
s=s.replace('Pinned Web Beta forces Premium in local AppState; normal mode reads a local plan,\nand profile copy says payments are not live. These are demo/simulation facts,', 'Pinned Web Beta defaults to local Premium while honoring explicit stored Free\nand the tester-plan switch (`apps/web/lib/edition.ts:11`,\n`apps/web/lib/edition.ts:13`, `apps/web/components/AppState.tsx:40`,\n`apps/web/components/Shell.tsx:86`). Normal mode also uses a local chosen plan;\nprofile copy at `apps/web/app/profile/page.tsx:137` says payments are not live.\nThese are demo/simulation facts,')
gaps='''## Functionality outside the forty-three-feature inventory

Newer Web source also contains capabilities without matching shared IDs. Their
presence does not add a catalog row, select a tier, or approve a release:

- Ask uses separate hardcoded monthly limits of 10 Free / 100 Premium at
  `apps/web/lib/ask.ts:7`; these remain outside the shared catalog.
- Owed renders a view and a user-copied draft at `apps/web/app/owed/page.tsx:14`
  and `apps/web/app/owed/page.tsx:30`; no external sending action is inferred.
- The three-day wait quest at `apps/web/lib/review.ts:312` is separate from
  WorthIt ratings.
- Glass level at `apps/web/components/ThemeV2.tsx:141` is a local preference,
  without a demonstrated entitlement ID.
- Island storyboard/film source at `apps/web/app/island/page.tsx:144` has no
  matching catalog ID or private/release approval inferred from its presence.
- TodayCard at `apps/web/components/TodayCard.tsx:9` is a composition surface,
  rather than an OS widget or a new shared quota.
- The card-payment reminder explicitly consumes `credit.insights` at
  `apps/web/components/CardDueReminder.tsx:47`.

Newer test files are source evidence only; this documentation refresh does not
execute application tests or establish runtime, purchase, security or release readiness.

'''
s=s.replace('## Owner decisions\n',gaps+'## Owner decisions\n')
s=s.replace('rights/limits/aliases, pending approvals, and the three deterministic matrices.', 'rights/limits/aliases, pending approvals, and the three deterministic matrices.\nIt also checks explicit full application path-and-line citations in JSON and both\ndocuments. Citation existence is not semantic proof; source review remains required.\nShortened continuation references are outside the automatic prose check.')
def table(heads,rows): return '\n'.join(['| '+' | '.join(heads)+' |','| '+' | '.join(['---']*len(heads))+' |']+['| '+' | '.join(row)+' |' for row in rows])
platforms=['web','iphone','macos']
sections={
 'feature':table(['Feature ID','Legacy minimum','Free right','Web source','iPhone source','macOS source','Beta / Stable'],[[f['id'],f['legacy']['minTier'],'yes' if f['freeRight'] else 'no']+[f['platforms'][k]['sourceStatus'] for k in platforms]+['pending / pending on all platforms'] for f in p['features']]),
 'quota':table(['Feature ID','Raw legacy limits','Web enforcement','iPhone enforcement','macOS enforcement','Pending decisions'],[[q['id'],'`'+json.dumps(q['legacyLimits'],separators=(',',':'))+'`']+[q['platformObservations'][k]['enforcement'] for k in platforms]+[', '.join(q['decisionIds'])] for q in p['quotaReviews']]),
 'apple-alias':table(['Apple case','Raw value','Current tier','Canonical ID','Proposed ID','Mapping'],[[a['appleCase'],a['rawValue'],a['currentMinTier'],a['canonicalId'] or 'none',a['proposedCanonicalId'] or 'none',a['mappingStatus']] for a in p['appleAliases']])}
for name,rendered in sections.items():
    start='<!-- '+name+'-matrix:start -->';end='<!-- '+name+'-matrix:end -->'
    assert s.count(start)==s.count(end)==1
    s=s.split(start)[0]+start+'\n'+rendered+'\n'+end+s.split(end)[1]
public.write_text(s)
apple=ROOT/'docs/APPLE-POLICY-MIGRATION.md'
s=apple.read_text().replace(OLD,NEW)
s=s.replace('No current helper replacement, policy activation, purchase adapter, native release,', 'Web observations were refreshed from `2d79390` to this pin. Apple sources and\nshared legacy declarations are unchanged between those pins; native observations\nand pending policy decisions remain preserved.\nNo current helper replacement, policy activation, purchase adapter, native release,')
apple.write_text(s)
checker=ROOT/'docs/scripts/check-public-feature-catalog.mjs'
s=checker.read_text().replace(OLD,NEW)
new_functions='''let proseCitations = 0;
function citationText(value, label) {
  const pattern = /\\b(apps\\/(?:web|apple)\\/[^\\s`"'<>():]+):([0-9]+)\\b/g;
  for (const match of value.matchAll(pattern)) {
    const path = match[1], lineNumber = Number(match[2]);
    const context = `${label}: explicit citation ${path}:${match[2]}`;
    safePath(path);
    assert(Number.isSafeInteger(lineNumber) && lineNumber > 0 && lineNumber <= 1_000_000, `${context}: bounded positive line required`);
    const line = source(path).split('\\n')[lineNumber - 1];
    assert(line !== undefined && line.trim().length > 0, `${context}: missing or blank pinned line`);
    proseCitations++;
  }
}
function embeddedCitations(value, label) {
  if (typeof value === 'string') citationText(value, label);
  else if (Array.isArray(value)) value.forEach((item, index) => embeddedCitations(item, `${label}[${index}]`));
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) embeddedCitations(item, `${label}.${key}`);
  }
}
'''
s=s.replace('const args = process.argv.slice(2);',new_functions+'const args = process.argv.slice(2);')
s=s.replace("for (const document of ['PUBLIC-FEATURE-CATALOG.md', 'APPLE-POLICY-MIGRATION.md']) {", "embeddedCitations(proposal, 'proposal');\nfor (const document of ['PUBLIC-FEATURE-CATALOG.md', 'APPLE-POLICY-MIGRATION.md']) {")
s=s.replace("  for (const id of decisionIds) assert(text.includes(`decision-${id}`), `${document}: missing owner decision ${id}`);", "  for (const id of decisionIds) assert(text.includes(`decision-${id}`), `${document}: missing owner decision ${id}`);\n  citationText(text, document);")
s=s.replace("console.log(`${proposal.features.length} features;", "assert(proseCitations > 0, 'Explicit prose application citations required');\nconsole.log(`${proposal.features.length} features;")
s=s.replace("console.log('Pinned evidence and review matrices: PASS');", "console.log(`Explicit prose application citations: ${proseCitations} checked`);\nconsole.log('Pinned evidence and review matrices: PASS');")
checker.write_text(s)
print('Four-file refresh written; immutable proposal sections preserved; exactly three Web status changes.')
