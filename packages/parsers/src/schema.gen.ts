/* Generated from packages/schema/lakshly.schema.json. Do not edit. */

export type Currency = string;
export type Id = string;
/**
 * Minor units (e.g. paise). Negative = outflow.
 */
export type Money = number;
export type Date = string;
export type Category =
  | "income"
  | "groceries"
  | "dining"
  | "transport"
  | "fuel"
  | "shopping"
  | "utilities"
  | "rent"
  | "health"
  | "education"
  | "entertainment"
  | "travel"
  | "subscriptions"
  | "insurance"
  | "investments"
  | "emi"
  | "fees"
  | "transfers"
  | "cash"
  | "gifts"
  | "other";

/**
 * Portable, versioned data model shared by the Apple and web apps. Amounts are integers in minor units (paise for INR) to avoid floating-point errors.
 */
export interface LakshlyDataset {
  schemaVersion: "0.1.0";
  generatedAt: string;
  /**
   * true when the dataset is generated demo data
   */
  synthetic?: boolean;
  notice?: string;
  currency: Currency;
  accounts: Account[];
  transactions: Transaction[];
  budgets?: Budget[];
  debts?: Debt[];
  sips?: Sip[];
  rewards?: Reward[];
}
export interface Account {
  id: Id;
  name: string;
  type:
    | "savings"
    | "current"
    | "credit_card"
    | "fixed_deposit"
    | "mutual_fund"
    | "stocks"
    | "epf"
    | "ppf"
    | "nps"
    | "wallet"
    | "loan"
    | "cash"
    | "other";
  institution: string;
  /**
   * Last 4 only; never store full numbers
   */
  mask?: string;
  currency: Currency;
  balance: Money;
  invested?: Money;
  creditLimit?: Money;
  statementDay?: number;
  dueDay?: number;
  asOf: Date;
  source?: "manual" | "statement" | "cas" | "email" | "aggregator";
}
export interface Transaction {
  id: Id;
  accountId: Id;
  date: Date;
  amount: Money;
  description: string;
  merchant?: string;
  category: Category;
  method?: "upi" | "card" | "netbanking" | "neft" | "imps" | "cash" | "autodebit" | "other";
  recurring?: boolean;
  tags?: string[];
  categorisedBy?: "rule" | "on_device_model" | "llm" | "user";
}
export interface Budget {
  id: Id;
  month: string;
  category: Category;
  limit: number;
  rollover?: boolean;
}
export interface Debt {
  id: Id;
  name: string;
  kind:
    | "home_loan"
    | "car_loan"
    | "personal_loan"
    | "education_loan"
    | "credit_card_emi"
    | "bnpl"
    | "gold_loan"
    | "family"
    | "other";
  lender?: string;
  principal: number;
  outstanding: number;
  annualRatePct: number;
  emi: number;
  startDate: Date;
  tenureMonths: number;
  accountId?: Id;
}
export interface Sip {
  id: Id;
  scheme: string;
  platform?: string;
  amount: number;
  dayOfMonth: number;
  startDate: Date;
  stepUpPctYearly?: number;
  status: "active" | "paused" | "stopped";
  accountId?: Id;
}
export interface Reward {
  id: Id;
  program: string;
  kind: "points" | "cashback" | "miles" | "voucher";
  balance: number;
  valuePerUnitPaise?: number;
  expiresOn?: Date;
  accountId?: Id;
  asOf: Date;
}
