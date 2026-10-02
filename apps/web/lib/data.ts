// Loads the SYNTHETIC demo dataset (copied from /demo-data at build time). Never real data.
import raw from "@/data/sample.synthetic.json";
import type { LakshlyDataset } from "./schema.gen";

export const dataset = raw as unknown as LakshlyDataset;

if (dataset.synthetic !== true) {
  throw new Error("Lakshly web only loads datasets labelled synthetic: true");
}

export const accounts = dataset.accounts;
export const transactions = dataset.transactions;
export const budgets = dataset.budgets ?? [];
export const debts = dataset.debts ?? [];
export const sips = dataset.sips ?? [];
export const rewards = dataset.rewards ?? [];
