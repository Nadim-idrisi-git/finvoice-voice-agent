// Deterministic answer validation. Runs before a text answer is returned.
// It cannot prove an answer is correct; it catches the highest-risk failures:
// money amounts that no tool returned, and success claims with no confirmed action.

const MONEY = /(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s?(?:rupees|rupaye|rupay|रुपये)/gi;

const toPaise = (text) => Math.round(Number(String(text).replace(/,/g, "")) * 100);

/** Every money amount mentioned in a piece of text, in paise. */
export function moneyAmounts(text) {
  const amounts = [];
  for (const m of String(text).matchAll(MONEY)) {
    const value = toPaise(m[1] ?? m[2]);
    if (Number.isFinite(value) && value > 0) amounts.push({ text: m[0].trim(), paise: value });
  }
  return amounts;
}

/** Collects every amount a tool result supports: *Paise numbers and formatted *Rupees strings, at any depth. */
export function supportedAmounts(results) {
  const allowed = new Set();
  const visit = (value, key = "") => {
    if (Array.isArray(value)) {
      const paiseList = /Paise$/.test(key);
      for (const item of value) paiseList && typeof item === "number" ? allowed.add(item) : visit(item);
    } else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) visit(v, k);
    else if (typeof value === "number" && /Paise$/.test(key)) allowed.add(value);
    else if (typeof value === "string") for (const a of moneyAmounts(value)) allowed.add(a.paise);
  };
  visit(results);
  return allowed;
}

// "Not found" is only allowed after a tool actually looked (unknown is not zero; absence needs evidence).
const NOT_FOUND_CLAIM = /couldn.?t find|could not find|can.?t find|no (matching )?(record|transaction|payment|charge)s?\b|didn.?t find|not (in|found in) your records|nahi mil(a|i)/i;

// Negated statements ("has not been sent", "nahi bheja") are not success claims.
const NEGATED = /\b(?:not|never|hasn.?t|haven.?t|isn.?t|wasn.?t|won.?t|nahi|nahin|nahi hua)\b[^.!?]{0,30}?\b(?:done|completed|submitted|sent|ho gaya|kar diya|bhej(?:a|diya))\b[^.!?]*/gi;
const SUCCESS_CLAIM = /\b(done|completed|submitted|sent to the bank|has been sent|ho gaya|ho gayi|confirm ho (?:gaya|chuka)|kar diya|bhej diya)\b/i;

/**
 * Checks a drafted answer against the evidence of this turn.
 * - amounts: every ₹ amount must appear in a tool result or in the user's own message (user-provided claim).
 * - success: claims that something was done require a SUCCEEDED action.
 * Returns { ok, unsupportedAmounts, unsupportedSuccess }.
 */
export function validateAnswer({ answer, toolResults, userMessage, hasSucceededAction, toolsCalled }) {
  const allowed = supportedAmounts(toolResults);
  for (const a of moneyAmounts(userMessage ?? "")) allowed.add(a.paise);
  // Exact match only: no unsupported rounding (₹119.67 must not become ₹120).
  const unsupportedAmounts = moneyAmounts(answer).filter((a) => !allowed.has(a.paise));
  const unsupportedSuccess = SUCCESS_CLAIM.test(String(answer).replace(NEGATED, "")) && !hasSucceededAction;
  // toolsCalled is undefined when the caller cannot know (voice); only enforce when known.
  const uncheckedNotFound = toolsCalled === 0 && NOT_FOUND_CLAIM.test(answer);
  return {
    ok: unsupportedAmounts.length === 0 && !unsupportedSuccess && !uncheckedNotFound,
    unsupportedAmounts,
    unsupportedSuccess,
    uncheckedNotFound,
  };
}

export const ABSTAIN_MESSAGE =
  "I couldn't verify that from your records, so I won't guess. I can tell you about your bank charges, autopays, balances, or bills, which I can check.";
