export interface SetupTransaction { id: string; date: string; amount: number; category: string; merchant?: string; tags?: string[] }
export interface BudgetLine { id: string; month: string; category: string; limit: number; rollover: boolean }
export interface SetupGoal { id: string; name: string; kind: 'emergency' | 'sinking' | 'custom'; target: number; saved: number; monthly: number; due: string; createdAt: string; createdBy: 'setup' }
export interface SetupDataset { transactions: SetupTransaction[]; accounts?: { type: string; balance: number }[]; budgets?: { month: string }[]; goals?: { id: string }[] }
export const variableCategories = ['groceries', 'dining', 'shopping', 'entertainment', 'travel', 'transport', 'fuel', 'gifts', 'other', 'subscriptions'];
export const isOut = (t: SetupTransaction) => t.amount < 0 && !(t.tags ?? []).some(x => x === 'refund' || x === 'big-ticket');
const median = (xs: number[]) => { const a = [...xs].sort((a,b) => a-b); return Math.trunc((a[Math.floor((a.length-1)/2)] + a[Math.floor(a.length/2)])/2); };
const day = (s: string) => new Date(s.slice(0,10) + 'T00:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0,10);
const ceilTo = (x: number, step: number) => Math.ceil(x / step) * step;
export function addYears(s: string, n = 1): string { const d = day(s); return iso(new Date(Date.UTC(d.getUTCFullYear()+n,d.getUTCMonth(),d.getUTCMonth()===1 ? Math.min(d.getUTCDate(),28) : d.getUTCDate()))); }
export function completeMonths(ds: SetupDataset, today: string): string[] {
  const dates = ds.transactions.map(t => t.date).sort(); if (!dates.length) return [];
  const f = day(dates[0]), end = today.slice(0,7), result: string[] = [];
  let m = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth()+(f.getUTCDate()>5 ? 1 : 0), 1));
  while (iso(m).slice(0,7) < end) { result.push(iso(m).slice(0,7)); m = new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+1,1)); }
  return result.slice(-3);
}
export function suggestBudget(ds: SetupDataset, today: string, factorPct = 95) {
  const months = completeMonths(ds,today);
  if (!months.length) return { mode: 'starter' as const, months, lines: [] as (BudgetLine & { median: number })[] };
  const candidates = variableCategories.map(category => ({ category, median: median(months.map(m => ds.transactions.filter(t => isOut(t) && t.category===category && t.date.slice(0,7)===m).reduce((v,t) => v-t.amount,0))) })).filter(c => c.median>=50000).sort((a,b) => b.median-a.median || a.category.localeCompare(b.category));
  const lines = candidates.slice(0,6).map(({category,median}) => { const x = median*factorPct, step = x>=500000*100 ? 50000 : 10000;
    return {id:`bud_${today.slice(0,7).replace('-','')}${category}`,month:today.slice(0,7),category,limit:Math.floor((x+step*50)/(step*100))*step,median,rollover:false}; });
  return { mode: 'history' as const, confidence: months.length>=2 ? 'ok' : 'low', months, factorPct, dropped:candidates.slice(6).map(c=>c.category),lines,total:lines.reduce((v,l)=>v+l.limit,0) };
}
export interface GoalSuggestion { rule: string; kind: 'emergency' | 'sinking' | 'custom'; name: string; target?: number; saved?: number; monthly?: number; due?: string; monthsCovered?: number | null; medianMonthlySpend?: number; fromTransaction?: string; monthsLeft?: number }
export function suggestGoal(ds: SetupDataset, today: string): GoalSuggestion {
  const months=completeMonths(ds,today);
  const med=months.length ? median(months.map(m=>ds.transactions.filter(t=>isOut(t)&&!['income','transfers','investments'].includes(t.category)&&t.date.slice(0,7)===m).reduce((v,t)=>v-t.amount,0))) : 0;
  const liquid=(ds.accounts??[]).filter(a=>['savings','current','cash','fixed_deposit'].includes(a.type)&&a.balance>0).reduce((v,a)=>v+a.balance,0);
  const cover10=med ? Math.floor(liquid*10/med) : null;
  const emergency=(n:number,rule:string):GoalSuggestion=>{const target=ceilTo(n*med,1000000),saved=Math.min(liquid,target);return {rule,kind:'emergency',name:`Emergency fund · ${n} months`,target,saved,monthly:target>saved ? Math.max(50000,ceilTo(Math.floor(Math.max(target-saved,0)/12),10000)):0,due:addYears(today),monthsCovered:cover10===null?null:cover10/10,medianMonthlySpend:med};};
  if (!months.length) return {rule:'custom',kind:'custom',name:'Something that matters to you'};
  if ((cover10??0)<30) return emergency(3,'emergency3');
  const cutoff=iso(new Date(day(today).getTime()-365*86400000));
  for (const t of [...ds.transactions].sort((a,b)=>b.date.localeCompare(a.date))) {
    if (!['insurance','fees','subscriptions','education'].includes(t.category)||!isOut(t)||-t.amount<500000||t.date<cutoff) continue;
    const prior=ds.transactions.some(u=>u!==t&&u.merchant===t.merchant&&day(t.date).getTime()-day(u.date).getTime()>0&&day(t.date).getTime()-day(u.date).getTime()<=300*86400000);
    const due=addYears(t.date);
    if (!prior&&due>today&&due<=addYears(today)) {
      const a=day(today),b=day(due),left=Math.max((b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth()-(b.getUTCDate()<a.getUTCDate()?1:0),1),target=ceilTo(-t.amount,100000);
      return {rule:'annualPayment',kind:'sinking',name:`${t.merchant} renewal`,target,saved:0,monthly:ceilTo(Math.ceil(target/left),10000),due,fromTransaction:t.id,monthsLeft:left,monthsCovered:(cover10??0)/10,medianMonthlySpend:med};
    }
  }
  return (cover10??0)<60 ? emergency(6,'emergency6') : {rule:'custom',kind:'custom',name:'Something that matters to you'};
}
export function goalFromSuggestion(ds: SetupDataset,today:string,now:string): SetupGoal | null {
  const g=suggestGoal(ds,today); if (g.target===undefined || !g.due) return null;
  return {id:'goal_setup01',name:g.name,kind:g.kind,target:g.target,saved:g.saved??0,monthly:g.monthly??0,due:g.due,createdAt:now,createdBy:'setup'};
}
