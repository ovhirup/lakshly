import type { Category } from "./types.ts";

type Method = "upi" | "card" | "netbanking" | "neft" | "imps" | "cash" | "autodebit" | "other";

/**
 * Simple on-device keyword rules. First match wins; order matters (specific before generic).
 * Brand keywords are public merchant names commonly seen in Indian statements.
 */
const RULES: [RegExp, Category][] = [
  [/\b(SALARY|SAL CREDIT|PAYROLL)\b/i, "income"],
  [/\b(INTEREST|INT\.?PD|INT CREDIT|DIVIDEND|CASHBACK)\b/i, "income"],
  [/\b(CREDIT CARD|CC BILL|CARD BILL|CARD PAYMENT|PAYMENT RECEIVED|AUTOPAY THANK|BBPS)\b/i, "transfers"],
  [/\b(SIP|MUTUAL FUND|MF |AMC|BSE STAR|NSE MF|ZERODHA|GROWW|COIN BY|KUVERA|NACH.*(MF|FUND))\b/i, "investments"],
  [/\b(EMI|LOAN|NBFC|BAJAJ FIN)\b/i, "emi"],
  [/\b(RENT|LANDLORD|NOBROKER|HOUSING)\b/i, "rent"],
  [/\b(INSURANCE|LIC |PREMIUM|POLICY)\b/i, "insurance"],
  [/\b(SWIGGY|ZOMATO|RESTAURANT|CAFE|DOSA|BIRYANI|CHAI|DOMINOS|PIZZA|STARBUCKS|EATCLUB|FOOD)\b/i, "dining"],
  [/\b(BIGBASKET|BLINKIT|ZEPTO|INSTAMART|DMART|GROCER|KIRANA|MORE RETAIL|RELIANCE FRESH|NATURES BASKET|ORGANIC)\b/i, "groceries"],
  [/\b(UBER|OLA|RAPIDO|METRO|IRCTC|AUTO RIDE|CAB|FASTAG|PARKING)\b/i, "transport"],
  [/\b(PETROL|FUEL|HPCL|BPCL|IOCL|INDIAN OIL|SHELL)\b/i, "fuel"],
  [/\b(AIRTEL|JIO|VODAFONE|\bVI\b|BESCOM|ELECTRICITY|POWER|BROADBAND|WATER|GAS|RECHARGE|BILLDESK)\b/i, "utilities"],
  [/\b(NETFLIX|SPOTIFY|PRIME|HOTSTAR|YOUTUBE|APPLE\.COM|GOOGLE ?PLAY|ICLOUD|SUBSCRIPTION|STREAM)\b/i, "subscriptions"],
  [/\b(PHARMA|PHARMACY|APOLLO|HOSPITAL|CLINIC|MEDICAL|1MG|NETMEDS|PRACTO|DIAGNOSTIC)\b/i, "health"],
  [/\b(MAKEMYTRIP|GOIBIBO|CLEARTRIP|INDIGO|AIR INDIA|VISTARA|HOTEL|OYO|AIRBNB|RAIL)\b/i, "travel"],
  [/\b(PVR|INOX|BOOKMYSHOW|CINEMA|CONCERT|GAMING)\b/i, "entertainment"],
  [/\b(SCHOOL|COLLEGE|UNIVERSITY|COURSE|UDEMY|COURSERA|TUITION|FEES? PAYMENT)\b/i, "education"],
  [/\b(AMAZON|FLIPKART|MYNTRA|AJIO|NYKAA|MEESHO|TATA CLIQ|CROMA|DECATHLON|IKEA|BAZAAR|FASHION|MALL)\b/i, "shopping"],
  [/\b(ATM|CASH WDL|CASH WITHDRAWAL|CWDR|NWD)\b/i, "cash"],
  [/\b(CHARGES|CHGS|FEE|GST|PENALTY|LATE PAYMENT|FINANCE CHARGE|ANNUAL FEE)\b/i, "fees"],
  [/\b(SELF TRANSFER|OWN ACCOUNT|SWEEP|FD BOOKED|TRANSFER TO|TRF TO|TO SELF)\b/i, "transfers"],
];

export function categorise(description: string, amount: number): Category {
  for (const [re, cat] of RULES) if (re.test(description)) {
    if (cat === "income" && amount < 0) continue;
    return cat;
  }
  return amount > 0 ? "income" : "other";
}

export function detectMethod(description: string, fallback: Method = "other"): Method {
  const d = description.toUpperCase();
  if (/\bUPI\b|UPI\//.test(d)) return "upi";
  if (/\bNEFT\b/.test(d)) return "neft";
  if (/\bIMPS\b/.test(d)) return "imps";
  if (/\b(NACH|ECS|ACH|AUTOPAY|SI-|STANDING INSTRUCTION|AUTO DEBIT)\b/.test(d)) return "autodebit";
  if (/\b(ATM|CASH)\b/.test(d)) return "cash";
  if (/\b(POS|CARD)\b/.test(d)) return "card";
  if (/\b(NETBANKING|NET BANKING|IB |BILLPAY|RTGS)\b/.test(d)) return "netbanking";
  return fallback;
}

/** Best-effort merchant name from a bank narration like "UPI/SWIGGY/1234@okaxis/Food". */
export function guessMerchant(description: string): string | undefined {
  const d = description.replace(/\s+/g, " ").trim()
    .replace(/\b[0-9X]{6,}\b/gi, " ")
    .replace(/^(UPI|POS|ECOM|NEFT|IMPS|RTGS|ACH|NACH|BIL|ONL|ATM WDL|ATM)(\s*(CR|DR|D|C))?[\s/:-]+/i, "")
    .replace(/^(P2M|P2A|DR|CR)[/-]/i, "")
    .trim();
  const first = d.split(/[/@*]|-(?=\S)| {2,}/)[0].trim();
  return first && /[A-Za-z]{3}/.test(first) ? tidy(first) : undefined;
}

function tidy(s: string): string {
  const t = s.replace(/\s+/g, " ").replace(/[\s\-/.:,]+$/, "").trim().slice(0, 80);
  return t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
