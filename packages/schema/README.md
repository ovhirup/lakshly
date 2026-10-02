# @lakshly/schema

The JSON Schema (draft 2020-12) for Lakshly's portable data model: `accounts`, `transactions`, `budgets`, `debts`, `sips` and `rewards`.

- Amounts are **integers in minor units** (paise for INR). Negative transaction amounts are outflows.
- Only the **last 4 digits** of any account or card number may be stored (`mask`).
- The schema is the contract between `apps/apple` (Swift `Codable` types) and `apps/web` (TypeScript types). Generate both from this file; don't hand-edit them.

Validate the synthetic sample:

```bash
python3 demo-data/generate.py --check   # requires `pip install jsonschema` for full validation
```

Licensed MIT (see `../LICENSE`).
