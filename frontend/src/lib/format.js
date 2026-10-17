// Pure money and calendar helpers shared by the API and the web client.
// Kept free of dependencies so the browser bundle can import it cheaply.

export const formatRupees = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** "YYYY-MM" for the UTC month containing `date`. */
export function currentMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return currentMonth(new Date(Date.UTC(y, m - 2, 1)));
}

/** "2026-08" -> "August 2026" */
export const monthName = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export const isValidMonth = (value) => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
