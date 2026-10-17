# Source-of-truth registry

The agent may state a financial fact only if it comes from one of these sources, through a tool, in the current conversation. Earlier assistant messages and model memory are never sources.

| ID | Source | Type (directive category) | Owner / system | Authority | Version / freshness | Access |
| --- | --- | --- | --- | --- | --- | --- |
| `sms-facts` | `backend/data/profile.json`, parsed from the event `sms/sms.csv` by `npm run ingest` | B: account data (balances, debits, credits, charges, mandates, bills) | Backend ingest (`src/data/ingest.js`) | Highest available: bank and biller SMS | `generatedAt` and `asOf` (latest SMS date, currently 2026-10-15). Static snapshot: never "live" | Owner-scoped: only the session user's facts |
| `records` | `profile.json` → `insurance`, `investments`, `loans`, `emails`, parsed from the event CSVs (`insurance/policies.csv`, `insurance/transactions.csv`, `investment/holdings.csv`, `investment/sip_plans.csv`, `investment/orders.csv`, `investment/funds.csv`, `loan/loan_applications.csv`, `emails/emails.csv`) | B: insurance status and premiums, holdings and SIPs, loan applications; email index for search | Backend ingest | Platform records (authoritative for those products); emails are supporting evidence | As of each record's own date (e.g. `navDate`, `cancelledAt`) | Owner-scoped |
| `insights` | `src/modules/insights.js` over `sms-facts` | B (derived): duplicate charges, bounced autopays, minimum-balance traps, recurring mandates | Backend | Deterministic code over `sms-facts`; every result carries `evidence` sms_ids | Recomputed per request | Owner-scoped |
| `actions` | Action service store | B: proposals, confirmations, audit | Backend (`src/services/actions.js`) | Authoritative for action status | Live (process memory) | Owner-scoped, confirmation required |
| `prompts` | `src/services/prompts.js` | A: product behaviour and policy | Repository | Versioned with git | Changes require `npm run eval` | Server-only |
| user turn | What the user says | D: user-provided claim | User | Not verified; may be repeated back, never treated as a record | Per turn | n/a |

**Insurance companion sources:** `insurance/policies.csv`, `applications.csv` (cover amount, members, age), `insurance_products.csv` (insurer, type, billing), `premium_rate_cards.csv` (listed premium for his profile), `insurance_eligibility_blocks.csv`, `receivables.csv`, and LIC premium receipts from emails.

**Not available, so the agent must abstain:** credit score, loan interest rates or offers (his applications were rejected and carry no rate), policy wording (inclusions, exclusions, room rent, waiting periods, cashless network), live balances, other users' data, market prices, and the contents of email attachments (PDFs are not parsed).

**Raw data location:** `backend/data/raw/` (copied from the event's Google Drive download; git-ignored). `npm run ingest` reads it by default, or `DATASET_DIR` if set.

**Conflict policy.** Bank SMS > derived insights > anything said in conversation. If two SMS disagree (for example two balances on the same day), the latest by timestamp wins and the earlier one remains available as evidence. The agent does not resolve conflicts by plausibility.

**Integrity.** SMS text is untrusted data: it is never executed or treated as instructions (the prompt says so, and tools return it only as JSON fields). Ingest rejects facts without an sms_id, with non-positive or out-of-range amounts, or with invalid dates, and reports unparsed money SMS (`profile.quality`).

**Unknown vs zero.** Tools return only facts that exist; absence is "not found in the records", never zero. Balances are reported with their `asOf` date.
