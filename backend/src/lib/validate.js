// Hand-written request validators. Each returns { value } on success or { error } with a client-safe message.

export const ACTION_TYPES = ["reminder", "spending_alert", "report", "subscription_workflow"];

const trimmed = (value) => (typeof value === "string" ? value.trim() : null);

export function validateMessage(body) {
  const message = trimmed(body?.message);
  if (!message || message.length > 1200) return { error: "Message must contain 1 to 1200 characters." };
  return { value: { message } };
}

export function validateAction(body) {
  if (!ACTION_TYPES.includes(body?.type)) return { error: `Action type must be one of: ${ACTION_TYPES.join(", ")}.` };
  const title = trimmed(body.title);
  if (!title || title.length < 3 || title.length > 100) return { error: "Title must contain 3 to 100 characters." };
  const details = trimmed(body.details);
  if (!details || details.length < 3 || details.length > 500)
    return { error: "Details must contain 3 to 500 characters." };
  return { value: { type: body.type, title, details } };
}

export const isExplicitConfirmation = (body) => body?.confirmation === true;
