# Lakshly Free bill of rights

These are never paywalled, in any edition, on any platform. The list is enforced in code: every id below is
`minTier: "free"` in [`packages/shared/entitlements.json`](../packages/shared/entitlements.json) (`freeBillOfRights`),
and a unit test fails if one of them is ever moved behind Premium.

- **App lock** (Face ID / passcode on Apple; vault lock on web)
- **On-device encryption** of your imported data
- **Statement import**: bank, card and mutual fund (CAS) PDFs and CSVs, parsed on your device
- **The core tabs**: Overview, Spend, Budget and History
- **Deleting all your data**, instantly, from the device
- **Exporting your own data**
- **Setup, automatic sync of one mailbox, the email search guide and every import** (sync and IMAP ship on Apple first; web uses the guided import)

Free budgets: one monthly budget with up to 6 category lines (Premium removes both limits).

Also always free: privacy mode (hide amounts), the weekly review, and all badges and XP. Premium can never buy XP or badges.

## How we nudge (Free tier)
- At most one proactive Premium nudge per screen, and one per 7 days. "Not now" snoozes it (30 days on the profile card).
- Never at launch, on the lock screen, after an error, or mid-task.
- No countdowns, fake discounts or guilt copy. "Restore purchases" is always visible.
