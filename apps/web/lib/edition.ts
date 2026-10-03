// Build edition. `NEXT_PUBLIC_LAKSHLY_EDITION=beta` builds the public web beta (beta.lakshly.com):
// a "Tester" profile, Premium unlocked, synthetic demo data by default, Theme System v2, a Beta ribbon and a feedback button.
// Without the flag (production) nothing here changes behaviour.
export type Edition = "public" | "beta";
export function editionFrom(value: string | undefined): Edition { return value === "beta" ? "beta" : "public"; }
// Literal access so Next inlines it at build time.
export const EDITION: Edition = editionFrom(process.env.NEXT_PUBLIC_LAKSHLY_EDITION);
export const IS_BETA = EDITION === "beta";
export const BETA_PROFILE_NAME = "Tester";

/** Gmail connect + Sign in with Google: beta only for now (Google restricted scope; Testing-mode test users). */
export const GMAIL_CONNECT = IS_BETA || process.env.NEXT_PUBLIC_LAKSHLY_GMAIL === "1";
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "285824172297-123lnqmgv8mmfmcjd53pa9ev6q9iknsb.apps.googleusercontent.com";
