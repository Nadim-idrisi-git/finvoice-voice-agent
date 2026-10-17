import mongoose, { Schema } from "mongoose";
const TransactionSchema = new Schema(
  {
    id: { type: String, required: true },
    ownerId: { type: String, required: true, index: true },
    occurredAt: { type: Date, required: true, index: true },
    merchant: { type: String, required: true },
    category: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["INR"], required: true },
    kind: { type: String, enum: ["expense", "income", "refund"], required: true },
  },
  { timestamps: true },
);
TransactionSchema.index({ ownerId: 1, occurredAt: -1 });
const ActionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    details: { type: String, required: true },
    status: { type: String, required: true },
    createdAt: { type: Date, required: true },
    confirmedAt: Date,
  },
  { timestamps: true },
);
const ReminderSchema = new Schema(
  { ownerId: { type: String, required: true, index: true }, title: String, details: String, createdAt: Date },
  { timestamps: true },
);
const TransactionModel = mongoose.models.Transaction ?? mongoose.model("Transaction", TransactionSchema);
const AgentActionModel = mongoose.models.AgentAction ?? mongoose.model("AgentAction", ActionSchema);
const ReminderModel = mongoose.models.Reminder ?? mongoose.model("Reminder", ReminderSchema);
export { AgentActionModel, ReminderModel, TransactionModel };
