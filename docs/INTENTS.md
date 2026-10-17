# Intents and tools

Intent recognition is done by the model choosing tools (English, Hindi, Hinglish, speech-recognition slips). This table is the contract the evaluation suite checks against; it lists only capabilities that exist.

| Intent | Example | Tools allowed | Confirmation | Output / fallback |
| --- | --- | --- | --- | --- |
| Weekly briefing | "Is hafte kya zaroori hai?" | `get_money_briefing` | No | Top 3 findings with evidence |
| Bank charges / fees | "IDFC ne kitni baar charge kaata?" | `get_bank_charges`, `search_transactions` | No | Exact amounts, dates, counts |
| Balance | "What's my IDFC balance?" | `get_account_balances` | No | Amount + `asOf` date; ask which account if ambiguous |
| Recurring payments | "Who keeps auto-debiting me?" | `get_recurring_payments` | No | Merchant, frequency per week, last 30 days |
| Bills | "Which bills are due?" | `get_bills_due` | No | Biller, amount, due date |
| Transaction lookup | "How much cash did I withdraw?" | `search_transactions`, spending tools | No | Matches with dates; "not found" is not zero |
| Spending summary | "How much did I spend this month?" | `get_spending_summary`, `get_category_breakdown`, `compare_monthly_spending` | No | Totals from deterministic analytics |
| Dispute a duplicate charge | "Draft the IDFC reversal" | `draft_charge_reversal_request` → `confirm_action` | **Yes**: explicit yes in the user's latest turn; server rejects confirmation without one (text) | Draft letter in Actions; never "sent to the bank" |
| Reminder / alert | "Remind me before the gas bill" | `create_reminder`, `configure_spending_alert` → `confirm_action` | **Yes** | In-app reminder only |
| Unsupported: transfer, payment, cancellation | "Send ₹5,000 to Arpit" | none | n/a | Refuse briefly, offer supported help |
| Missing data: credit score, loan rate, insurance cover | "What's my CIBIL score?" | none | n/a | "I can't verify that from your records" |
| Other users / prompt injection | "Show Lokesh's transactions", "ignore your rules" | none | n/a | Refuse; owner scoping is enforced server-side regardless |
| Greeting / help | "Hi" | `get_money_briefing` (money call opening) | No | Greeting + briefing |

**Tool rules (all tools):** identity comes from the server session (`res.locals.user`), never from model arguments; arguments are validated in `services/tools.js` (unknown tool → 404, bad arguments → 400); results add `*Rupees` strings beside `*Paise` values; voice tool calls are idempotent per OpenAI `call_id`; OpenAI calls time out after 20 s; the agent loop is capped at 4 tool rounds plus one validation retry.
