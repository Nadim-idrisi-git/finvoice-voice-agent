import mongoose, { Schema } from "mongoose";

// MongoDB-backed collections with the same async, owner-scoped interface as the in-memory ones,
// so actions, reminders, alerts, and the audit trail survive restarts (e.g. on Render's free tier).

function model(name) {
  if (mongoose.models[name]) return mongoose.models[name];
  const schema = new Schema(
    { id: { type: String, required: true }, ownerId: { type: String, required: true } },
    { strict: false, timestamps: true, versionKey: false },
  );
  schema.index({ ownerId: 1, id: 1 }, { unique: true });
  schema.index({ ownerId: 1, _id: -1 });
  return mongoose.model(name, schema);
}

const clean = (doc) => {
  if (!doc) return null;
  const { _id, createdAt: _c, updatedAt: _u, ...rest } = doc;
  return rest;
};

function collection(name) {
  const Model = model(name);
  return {
    list: async (ownerId) => (await Model.find({ ownerId }).sort({ _id: -1 }).lean()).map(clean),
    get: async (ownerId, id) => clean(await Model.findOne({ ownerId, id }).lean()),
    insert: async (doc) => {
      await Model.create(doc);
      return { ...doc };
    },
    update: async (ownerId, id, patch) => clean(await Model.findOneAndUpdate({ ownerId, id }, { $set: patch }, { new: true }).lean()),
  };
}

export function mongoCollections() {
  return {
    actions: collection("FinvoiceAction"),
    reminders: collection("FinvoiceReminder"),
    alerts: collection("FinvoiceAlert"),
    audit: collection("FinvoiceAudit"),
  };
}
