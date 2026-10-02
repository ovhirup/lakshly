#!/usr/bin/env python3
"""Generate SYNTHETIC Lakshly demo data (INR).

Every name, institution, merchant and amount produced here is fictional and
randomly generated from a fixed seed. Nothing is derived from real accounts.

Usage:
  python3 demo-data/generate.py                  # writes demo-data/sample.synthetic.json
  python3 demo-data/generate.py --seed 7 --months 6 --out /tmp/demo.json
  python3 demo-data/generate.py --check          # validate sample against the schema
"""
from __future__ import annotations

import argparse
import json
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "packages" / "schema" / "lakshly.schema.json"
DEFAULT_OUT = Path(__file__).resolve().parent / "sample.synthetic.json"
NOTICE = "SYNTHETIC DEMO DATA. All names, institutions, merchants and amounts are fictional."

# Deliberately fictional, clearly-labelled names.
MERCHANTS = {
    "groceries": ["Demo Green Grocer", "Sample Kirana Store", "Example Organics"],
    "dining": ["Demo Dosa Corner", "Sample Chai Stall", "Example Biryani House"],
    "transport": ["Demo Metro Card", "Sample Cab Co", "Example Auto Ride"],
    "fuel": ["Demo Fuel Station"],
    "shopping": ["Sample Bazaar Online", "Demo Fashion Hub"],
    "utilities": ["Demo Power Board", "Sample Broadband", "Example Mobile Recharge"],
    "rent": ["Demo Landlord (Rent)"],
    "health": ["Sample Pharmacy", "Demo Clinic"],
    "entertainment": ["Demo Cinema", "Sample Concert Pass"],
    "subscriptions": ["Demo Stream+", "Sample Tunes Pro", "Example Cloud Storage"],
    "travel": ["Sample Rail Booking", "Demo Air"],
    "insurance": ["Demo Health Insurance"],
}
SPEND_RANGE_RUPEES = {
    "groceries": (150, 3500), "dining": (80, 1800), "transport": (40, 600), "fuel": (500, 3000),
    "shopping": (300, 6000), "utilities": (199, 2500), "rent": (18000, 18000), "health": (120, 2500),
    "entertainment": (150, 1500), "subscriptions": (99, 649), "travel": (800, 9000), "insurance": (1500, 1500),
}
WEIGHTS = {"groceries": 10, "dining": 9, "transport": 9, "fuel": 2, "shopping": 4, "utilities": 3,
           "health": 2, "entertainment": 2, "subscriptions": 3, "travel": 1}


def _id(rng: random.Random, prefix: str) -> str:
    return f"{prefix}_" + "".join(rng.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(8))


def paise(rupees: float) -> int:
    return int(round(rupees * 100))


def generate(seed: int = 42, months: int = 3, today: date | None = None) -> dict:
    rng = random.Random(seed)
    today = today or date(2026, 10, 1)
    start = (today.replace(day=1) - timedelta(days=31 * (months - 1))).replace(day=1)

    def mask() -> str:
        return f"{rng.randint(0, 9999):04d}"

    acc = {
        "savings": {"id": _id(rng, "acc"), "name": "Everyday Savings", "type": "savings", "institution": "Demo Bank",
                    "mask": mask(), "currency": "INR", "balance": 0, "asOf": today.isoformat(), "source": "statement"},
        "card": {"id": _id(rng, "acc"), "name": "Rewards Card", "type": "credit_card", "institution": "Sample Card Co",
                 "mask": mask(), "currency": "INR", "balance": 0, "creditLimit": paise(150000), "statementDay": 12,
                 "dueDay": 2, "asOf": today.isoformat(), "source": "email"},
        "mf": {"id": _id(rng, "acc"), "name": "Mutual Fund Folio", "type": "mutual_fund", "institution": "Example AMC (Demo)",
               "currency": "INR", "balance": paise(rng.randint(80000, 400000)), "invested": 0, "asOf": today.isoformat(), "source": "cas"},
        "fd": {"id": _id(rng, "acc"), "name": "1-Year Fixed Deposit", "type": "fixed_deposit", "institution": "Demo Small Finance Bank",
               "currency": "INR", "balance": paise(rng.choice([50000, 100000, 200000])), "asOf": today.isoformat(), "source": "manual"},
        "loan": {"id": _id(rng, "acc"), "name": "Personal Loan", "type": "loan", "institution": "Sample NBFC (Demo)",
                 "currency": "INR", "balance": 0, "asOf": today.isoformat(), "source": "manual"},
    }
    acc["mf"]["invested"] = int(acc["mf"]["balance"] / rng.uniform(1.02, 1.18))

    txns: list[dict] = []
    salary = paise(rng.randint(60, 180) * 1000)
    savings_bal = paise(rng.randint(40000, 120000))
    card_bal = 0
    cats, weights = zip(*WEIGHTS.items())
    d = start
    while d <= today:
        if d.day == 1:
            txns.append({"id": _id(rng, "txn"), "accountId": acc["savings"]["id"], "date": d.isoformat(), "amount": salary,
                         "description": "SALARY CREDIT - DEMO EMPLOYER PVT LTD", "merchant": "Demo Employer", "category": "income",
                         "method": "neft", "recurring": True, "categorisedBy": "rule"})
            savings_bal += salary
            for cat in ("rent", "insurance"):
                amt = -paise(SPEND_RANGE_RUPEES[cat][0])
                txns.append({"id": _id(rng, "txn"), "accountId": acc["savings"]["id"], "date": d.isoformat(), "amount": amt,
                             "description": f"{MERCHANTS[cat][0].upper()} AUTOPAY", "merchant": MERCHANTS[cat][0], "category": cat,
                             "method": "autodebit", "recurring": True, "categorisedBy": "rule"})
                savings_bal += amt
        if d.day == 5:
            for sip_amt in (5000, 3000):
                txns.append({"id": _id(rng, "txn"), "accountId": acc["savings"]["id"], "date": d.isoformat(), "amount": -paise(sip_amt),
                             "description": "SIP DEBIT - EXAMPLE AMC (DEMO)", "merchant": "Example AMC (Demo)", "category": "investments",
                             "method": "autodebit", "recurring": True, "categorisedBy": "rule"})
                savings_bal -= paise(sip_amt)
            txns.append({"id": _id(rng, "txn"), "accountId": acc["savings"]["id"], "date": d.isoformat(), "amount": -paise(8500),
                         "description": "EMI - SAMPLE NBFC (DEMO)", "merchant": "Sample NBFC (Demo)", "category": "emi",
                         "method": "autodebit", "recurring": True, "categorisedBy": "rule"})
            savings_bal -= paise(8500)
        for _ in range(rng.choices([0, 1, 2, 3], [2, 4, 3, 1])[0]):
            cat = rng.choices(cats, weights)[0]
            lo, hi = SPEND_RANGE_RUPEES[cat]
            amt = -paise(rng.randint(lo, hi))
            merchant = rng.choice(MERCHANTS[cat])
            on_card = rng.random() < 0.45
            method = "card" if on_card else "upi"
            txns.append({"id": _id(rng, "txn"), "accountId": acc["card" if on_card else "savings"]["id"], "date": d.isoformat(),
                         "amount": amt, "description": f"{method.upper()}/{merchant.upper()}", "merchant": merchant,
                         "category": cat, "method": method, "recurring": cat == "subscriptions",
                         "categorisedBy": rng.choice(["rule", "rule", "on_device_model", "llm"])})
            if on_card:
                card_bal += amt
            else:
                savings_bal += amt
        d += timedelta(days=1)

    acc["savings"]["balance"] = savings_bal
    acc["card"]["balance"] = card_bal
    acc["loan"]["balance"] = -paise(rng.randint(80, 250) * 1000)

    months_list = sorted({t["date"][:7] for t in txns})
    budgets = [{"id": _id(rng, "bud"), "month": m, "category": c, "limit": paise(lim), "rollover": c == "dining"}
               for m in months_list for c, lim in (("groceries", 9000), ("dining", 6000), ("transport", 3500), ("shopping", 8000))]
    debts = [{"id": _id(rng, "debt"), "name": "Personal Loan", "kind": "personal_loan", "lender": "Sample NBFC (Demo)",
              "principal": paise(300000), "outstanding": -acc["loan"]["balance"], "annualRatePct": 13.5, "emi": paise(8500),
              "startDate": "2025-04-05", "tenureMonths": 42, "accountId": acc["loan"]["id"]}]
    sips = [{"id": _id(rng, "sip"), "scheme": "Example Flexi Cap Fund - Direct Growth (Demo)", "platform": "Demo Invest App",
             "amount": paise(5000), "dayOfMonth": 5, "startDate": "2024-01-05", "stepUpPctYearly": 10, "status": "active",
             "accountId": acc["mf"]["id"]},
            {"id": _id(rng, "sip"), "scheme": "Sample Nifty Index Fund - Direct Growth (Demo)", "platform": "Demo Invest App",
             "amount": paise(3000), "dayOfMonth": 5, "startDate": "2025-06-05", "status": "active", "accountId": acc["mf"]["id"]}]
    rewards = [{"id": _id(rng, "rwd"), "program": "Sample Card Co Rewards", "kind": "points", "balance": rng.randint(1500, 12000),
                "valuePerUnitPaise": 25, "expiresOn": "2027-03-31", "accountId": acc["card"]["id"], "asOf": today.isoformat()}]

    return {
        "schemaVersion": "0.1.0",
        "generatedAt": datetime(today.year, today.month, today.day, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"),
        "synthetic": True,
        "notice": NOTICE,
        "currency": "INR",
        "accounts": list(acc.values()),
        "transactions": txns,
        "budgets": budgets,
        "debts": debts,
        "sips": sips,
        "rewards": rewards,
    }


def check(path: Path) -> int:
    data = json.loads(path.read_text())
    assert data.get("synthetic") is True, "dataset must be labelled synthetic"
    try:
        import jsonschema  # type: ignore
    except ImportError:
        print("jsonschema not installed; basic checks passed (pip install jsonschema for full validation)")
        return 0
    jsonschema.validate(data, json.loads(SCHEMA.read_text()))
    print(f"OK: {path.name} is valid against {SCHEMA.name} ({len(data['transactions'])} transactions)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--months", type=int, default=3)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--check", action="store_true", help="validate --out against the schema and exit")
    a = ap.parse_args()
    if a.check:
        return check(a.out)
    a.out.write_text(json.dumps(generate(a.seed, a.months), indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {a.out} (synthetic)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
