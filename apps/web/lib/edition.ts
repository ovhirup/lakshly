// Build edition. `NEXT_PUBLIC_LAKSHLY_EDITION=beta` builds the public web beta (beta.lakshly.com):
// a "Tester" profile, Premium unlocked, synthetic demo data by default, Theme System v2, a Beta ribbon and a feedback button.
// Without the flag (production) nothing here changes behaviour.
export type Edition = "public" | "beta";
export function editionFrom(value: string | undefined): Edition { return value === "beta" ? "beta" : "public"; }
// Literal access so Next inlines it at build time.
export const EDITION: Edition = editionFrom(process.env.NEXT_PUBLIC_LAKSHLY_EDITION);
export const IS_BETA = EDITION === "beta";
export const BETA_PROFILE_NAME = "Tester";
