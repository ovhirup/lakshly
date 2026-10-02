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


EMI_RUPEES = 8500
SIP_RUPEES = (5000, 3000)


def month_starts(today: date, months: int) -> list[date]:
    """First day of each of the `months` complete months before `today`'s month."""
    out, y, m = [], today.year, today.month
    for _ in range(months):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
        out.append(date(y, m, 1))
    return out[::-1]


def generate(seed: int = 42, months: int = 6, today: date | None = None) -> dict:
    rng = random.Random(seed)
    today = today or date(2026, 10, 1)

    def mask() -> str:
        return f"{rng.randint(0, 9999):04d}"

    acc = {
        "savings": {"id": _id(rng, "acc"), "name": "Everyday Savings", "type": "savings", "institution": "Demo Bank",
                    "mask": mask(), "currency": "INR", "balance": 0, "asOf": today.isoformat(), "source": "statement"},
        "card": {"id": _id(rng, "acc"), "name": "Rewards Card", "type": "credit_card", "institution": "Sample Card Co",
                 "mask": mask(), "currency": "INR", "balance": 0, "creditLimit": paise(150000), "statementDay": 5,
                 "dueDay": 25, "asOf": today.isoformat(), "source": "email"},
        "mf": {"id": _id(rng, "acc"), "name": "Mutual Fund Folio", "type": "mutual_fund", "institution": "Example AMC (Demo)",
               "currency": "INR", "balance": paise(rng.randint(80000, 400000)), "invested": 0, "asOf": today.isoformat(), "source": "cas"},
        "fd": {"id": _id(rng, "acc"), "name": "1-Year Fixed Deposit", "type": "fixed_deposit", "institution": "Demo Small Finance Bank",
               "currency": "INR", "balance": paise(rng.choice([50000, 100000, 200000])), "asOf": today.isoformat(), "source": "manual"},
        "loan": {"id": _id(rng, "acc"), "name": "Personal Loan", "type": "loan", "institution": "Sample NBFC (Demo)",
                 "currency": "INR", "balance": 0, "asOf": today.isoformat(), "source": "manual"},
    }
    acc["mf"]["invested"] = int(acc["mf"]["balance"] / rng.uniform(1.02, 1.18))

    txns: list[dict] = []
    # Comfortable salaried profile: income always exceeds spending, and each month's
    # savings rate (income - spend - investments) / income lands in a healthy band.
    salary = paise(rng.randint(125, 160) * 1000)
    savings_bal = paise(rng.randint(60000, 150000))
    card = acc["card"]
    card_bal = 0           # running card balance (negative = owed)
    statement_due = 0      # last statement amount awaiting payment (positive)
    cats, weights = zip(*WEIGHTS.items())

    def add(account: str, d: date, amount: int, merchant: str, category: str, method: str,
            description: str, recurring: bool = False, by: str = "rule") -> None:
        nonlocal savings_bal, card_bal
        txns.append({"id": _id(rng, "txn"), "accountId": acc[account]["id"], "date": d.isoformat(), "amount": amount,
                     "description": description, "merchant": merchant, "category": category, "method": method,
                     "recurring": recurring, "categorisedBy": by})
        if account == "card":
            card_bal += amount
        else:
            savings_bal += amount

    fixed_rupees = SPEND_RANGE_RUPEES["rent"][0] + SPEND_RANGE_RUPEES["insurance"][0] + EMI_RUPEES
    sip_rupees = sum(SIP_RUPEES)
    for m_start in month_starts(today, months):
        m_end = (m_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        target_rate = rng.uniform(0.22, 0.33)
        # Discretionary budget so that saved / income == target_rate (approximately, never below it).
        budget = paise(salary / 100 * (1 - target_rate) - fixed_rupees - sip_rupees)
        spent = 0
        d = m_start
        while d <= m_end:
            if d.day == 1:
                add("savings", d, salary, "Demo Employer", "income", "neft", "SALARY CREDIT - DEMO EMPLOYER PVT LTD", True)
                for cat in ("rent", "insurance"):
                    m = MERCHANTS[cat][0]
                    add("savings", d, -paise(SPEND_RANGE_RUPEES[cat][0]), m, cat, "autodebit", f"{m.upper()} AUTOPAY", True)
            if d.day == 5:
                for sip_amt in SIP_RUPEES:
                    add("savings", d, -paise(sip_amt), "Example AMC (Demo)", "investments", "autodebit",
                        "SIP DEBIT - EXAMPLE AMC (DEMO)", True)
                add("savings", d, -paise(EMI_RUPEES), "Sample NBFC (Demo)", "emi", "autodebit", "EMI - SAMPLE NBFC (DEMO)", True)
            if d.day == card["statementDay"]:
                statement_due = -card_bal
            if d.day == card["dueDay"] and statement_due > 0:
                # Card bill paid in full every month (a transfer, not spending).
                add("savings", d, -statement_due, "Sample Card Co", "transfers", "netbanking", "CREDIT CARD BILL PAYMENT - SAMPLE CARD CO", True)
                add("card", d, statement_due, "Sample Card Co", "transfers", "netbanking", "PAYMENT RECEIVED - THANK YOU", True)
                statement_due = 0
            for _ in range(rng.choices([0, 1, 2, 3], [2, 4, 3, 1])[0]):
                cat = rng.choices(cats, weights)[0]
                lo, hi = SPEND_RANGE_RUPEES[cat]
                amt = paise(rng.randint(lo, hi))
                if spent + amt > budget:
                    continue
                spent += amt
                merchant = rng.choice(MERCHANTS[cat])
                on_card = rng.random() < 0.45
                method = "card" if on_card else "upi"
                add("card" if on_card else "savings", d, -amt, merchant, cat, method, f"{method.upper()}/{merchant.upper()}",
                    cat == "subscriptions", rng.choice(["rule", "rule", "on_device_model", "llm"]))
            d += timedelta(days=1)
        # Top up quieter months with a few extra purchases so every month lands near its target.
        while budget - spent > paise(salary / 100 * 0.025):
            cat = rng.choice(["shopping", "groceries", "dining", "travel", "entertainment"])
            lo, hi = SPEND_RANGE_RUPEES[cat]
            amt = paise(rng.randint(lo, min(hi, max(lo, (budget - spent) // 100))))
            if spent + amt > budget:
                break
            spent += amt
            merchant = rng.choice(MERCHANTS[cat])
            day = m_start.replace(day=rng.randint(6, m_end.day))
            # Paid by UPI from savings so the card statement cycle above stays consistent.
            add("savings", day, -amt, merchant, cat, "upi", f"UPI/{merchant.upper()}", False,
                rng.choice(["rule", "on_device_model", "llm"]))

    txns.sort(key=lambda t: t["date"])

    acc["savings"]["balance"] = savings_bal
    acc["card"]["balance"] = card_bal
    acc["loan"]["balance"] = -paise(rng.randint(80, 250) * 1000)

    months_list = sorted({t["date"][:7] for t in txns})
    budgets = [{"id": _id(rng, "bud"), "month": m, "category": c, "limit": paise(lim), "rollover": c == "dining"}
               for m in months_list for c, lim in (("groceries", 9000), ("dining", 6000), ("transport", 3500), ("shopping", 8000))]
    debts = [{"id": _id(rng, "debt"), "name": "Personal Loan", "kind": "personal_loan", "lender": "Sample NBFC (Demo)",
              "principal": paise(300000), "outstanding": -acc["loan"]["balance"], "annualRatePct": 13.5, "emi": paise(EMI_RUPEES),
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
    ap.add_argument("--months", type=int, default=6)
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
