import { describe, it, expect } from 'vitest';
import { suggestGoal, suggestBudget } from '../setup/suggest';

// WP1 B2: the shared reference reads its thresholds from the currency table. INR is pinned by setup.test.ts; this pins USD.
const txn = (date: string, amount: number) => ({ id: 't' + date, date, amount, category: 'groceries' });
const ds = { transactions: [txn('2026-06-10', -123400), txn('2026-07-10', -123400), txn('2026-08-10', -123400)], accounts: [] };

describe('shared setup reference, USD', () => {
  it('rounds an emergency target to goalEmergencyRounding ($500), not goalTargetRounding ($100)', () => {
    const g = suggestGoal(ds, '2026-09-15', 'USD');
    expect(g.rule).toBe('emergency3');
    expect(g.target).toBe(400000); // 3 x $1,234 = $3,702 -> $4,000
    expect((g.target as number) % 50000).toBe(0);
  });
  it('keeps a $30 median line that INR drops, and rounds on the USD grid', () => {
    const small = { transactions: ['2026-06-10', '2026-07-10', '2026-08-10'].map((d) => txn(d, -3000)), accounts: [] };
    expect(suggestBudget(small, '2026-09-15', 100, 'USD').lines.map((l) => l.category)).toEqual(['groceries']);
    expect(suggestBudget(small, '2026-09-15', 100, 'INR').lines).toEqual([]);
  });
});
