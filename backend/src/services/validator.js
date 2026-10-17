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
      for (const item of value) paiseList && typeof item === "number" ? allowed.add(Math.abs(item)) : visit(item);
    } else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) visit(v, k);
    // Spoken amounts carry no sign ("a loss of ₹30.11"), so compare magnitudes.
    else if (typeof value === "number" && /Paise$/.test(key)) allowed.add(Math.abs(value));
    else if (typeof value === "string") for (const a of moneyAmounts(value)) allowed.add(a.paise);
  };
  visit(results);
  return allowed;
}

// "Not found" is only allowed after a tool actually looked (unknown is not zero; absence needs evidence).
const NOT_FOUND_CLAIM = /couldn.?t find|could not find|can.?t find|no (matching )?(record|transaction|payment|charge)s?\b|didn.?t find|not (in|found in) your records|nahi mil(a|i)/i;

// Negated statements ("has not been sent", "nahi bheja") are not success claims.
const NEGATED = /\b(?:not|never|nothing|no|hasn.?t|haven.?t|isn.?t|wasn.?t|won.?t|nahi|nahin)\b[^.!?]{0,40}?\b(?:done|completed|submitted|sent|saved|confirmed|ho gaya|kar diya|bhej(?:a|diya))\b[^.!?]*/gi;
// A success claim is about the assistant's own action (draft, request, reminder...), not events in the records
// ("loan reject ho gaya" is a fact from the data, not a claim that the assistant did something).
const ACTION_WORDS = String.raw`(?:draft|request|reminder|alert|action|proposal|reversal|dispute|actions tab)`;
const DONE_WORDS = String.raw`(?:done|completed|submitted|sent|saved|confirmed|confirm ho (?:gaya|gayi|chuka|chuki)|ho gaya|ho gayi|ho chuka|ho chuki|kar diya|kar di|bhej diya)`;
const SUCCESS_CLAIM = new RegExp(
  String.raw`\b${ACTION_WORDS}\b[^.!?\n]{0,60}?\b${DONE_WORDS}\b|\b(?:done|ho gaya)\b[^.!?\n]{0,80}?\b${ACTION_WORDS}\b|\b(?:main(?:ne)?|maine|i(?:'ve| have)?)\b[^.!?\n]{0,30}?\b${DONE_WORDS}\b`,
  "i",
);

/**
 * Checks a drafted answer against the evidence of this turn.
 * - amounts: every ₹ amount must appear in a tool result or in the user's own message (user-provided claim).
 * - success: claims that something was done require a SUCCEEDED action.
 * Returns { ok, unsupportedAmounts, unsupportedSuccess }.
 */
// "Draft ready / draft ho gaya" reports a proposal, not a completed action.
const DRAFT_CLAIM = /\b(?:request |claim |reversal )?draft\b[^.!?\n]{0,25}?\b(?:ho gaya|ho gayi|ready|ban gaya|ban gayi|taiyaar|kar diya|kar di|bana diya|created|prepared)\b|\b(?:drafted|draft kar (?:diya|di|liya))\b/gi;

export function validateAnswer({ answer, toolResults, userMessage, hasSucceededAction, hasProposedAction, toolsCalled }) {
  const allowed = supportedAmounts(toolResults);
  for (const a of moneyAmounts(userMessage ?? "")) allowed.add(a.paise);
  // Exact match only: no unsupported rounding (₹119.67 must not become ₹120).
  const unsupportedAmounts = moneyAmounts(answer).filter((a) => !allowed.has(a.paise));
  const withoutNegations = String(answer).replace(NEGATED, "");
  const claimsDraft = DRAFT_CLAIM.test(withoutNegations);
  DRAFT_CLAIM.lastIndex = 0;
  // Draft statements are fine when a proposal exists; strip them before checking for completion claims.
  const remaining = hasProposedAction || hasSucceededAction ? withoutNegations.replace(DRAFT_CLAIM, "") : withoutNegations;
  const unsupportedSuccess =
    (SUCCESS_CLAIM.test(remaining) && !hasSucceededAction) || (claimsDraft && !hasProposedAction && !hasSucceededAction);
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
