# Data model

The synthetic domain includes user, transaction, merchant/category, subscription candidate, bill, EMI schedule, reminder, spending alert, agent action, and audit event. Every record is scoped by `ownerId`. Amounts are integer paise, dates are ISO timestamps, currency is INR, and transaction generation is deterministic for a supplied date.

The fixture lives in `backend/src/data/seed.js`; `npm run seed` writes its transactions to MongoDB using the Mongoose models in `backend/src/data/models.js`. At runtime the API reads through an async, owner-scoped store interface (`backend/src/store/memory.js`). The in-memory implementation keeps actions, reminders, alerts, and audit events in process memory; a MongoDB implementation of the same interface is the intended path to durability and remains future work. No real financial record is required or accepted.
