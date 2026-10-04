import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const proposalPath = resolve('docs/public-feature-catalog.proposal.json');
const checkerPath = resolve('docs/scripts/check-public-feature-catalog.mjs');
const original = fs.readFileSync(proposalPath);
const digest = b => createHash('sha256').update(b).digest('hex');

const cases = [
  ['missing feature', p => p.features.pop(), /43 feature IDs\/order/],
  ['altered legacy label', p => { p.features[0].legacy.label += ' invalid'; }, /complete legacy object/],
  ['normalized absent merchant Premium', p => {
    p.features.find(f => f.id === 'review.merchantRules').legacy.limits.premium = null;
  }, /complete legacy object/],
  ['premature approval', p => {
    p.features[0].platforms.web.releaseProposal.beta.approval = 'approved';
  }, /Premature release approval/],
  ['widget mapped to review.widget', p => {
    p.appleAliases.find(a => a.appleCase === 'basicWidgets').canonicalId = 'review.widget';
  }, /Widget canonical ID must remain null/],
  ['unsafe structured path', p => {
    p.features[0].platforms.web.evidence[0].path = '../unsafe';
  }, /Unsafe evidence path/],
  ['wrong structured needle', p => {
    p.features[0].platforms.web.evidence[0].needle = '__P36_MISSING_NEEDLE__';
  }, /incorrect pinned evidence needle/],
  ['wrong explicit note citation', p => {
    const re = /\b(apps\/(?:web|apple)\/[^\s`"'<>():]+):([0-9]+)\b/;
    const feature = p.features.find(f => re.test(f.platforms.web.notes));
    if (!feature) throw new Error('No explicit Web note citation to mutate');
    feature.platforms.web.notes = feature.platforms.web.notes.replace(
      re, 'apps/web/__P36_MISSING_SOURCE__.tsx:$2'
    );
  }, /Pinned source retrieval failed|explicit.*citation/i]
];

for (const [name,mutate,error] of cases) {
  const childCode = `
    import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    import {pathToFileURL} from 'node:url';
    const filename = ${JSON.stringify(proposalPath)};
    const originalRead = fs.readFileSync;
    const p = JSON.parse(originalRead(filename,'utf8'));
    (${mutate.toString()})(p);
    fs.readFileSync = function(file,...rest) {
      return String(file) === filename ? JSON.stringify(p) : originalRead(file,...rest);
    };
    syncBuiltinESMExports();
    await import(pathToFileURL(${JSON.stringify(checkerPath)}).href);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module','-e',childCode], {
    encoding:'utf8',timeout:30_000,maxBuffer:2*1024*1024
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.error || result.status !== 1 || !error.test(output))
    throw new Error(`${name}: unexpected result ${result.status}\n${output}`);
  console.log(`${name}: rejected (exit 1)`);
}
if (digest(original) !== digest(fs.readFileSync(proposalPath)))
  throw new Error('Real proposal bytes changed');
console.log('8/8 malformed proposals rejected; real proposal bytes unchanged');
