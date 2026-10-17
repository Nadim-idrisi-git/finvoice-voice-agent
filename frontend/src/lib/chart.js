export const colors = ["#59a880", "#82c6a2", "#b6ddc7", "#dae9df", "#92ae9e"];
export function chartSeries(daily, month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cumulative = new Map();
  let sum = 0;
  for (const row of [...daily].sort((a, b) => a.day - b.day)) {
    sum += row.amountPaise;
    cumulative.set(row.day, sum);
  }
  const max = Math.max(sum, 1);
  const points = [[0, 82]];
  for (let day = 1; day <= days; day++) {
    if (cumulative.has(day)) {
      points.push([((day - 1) / (days - 1)) * 620, 82 - (cumulative.get(day) / max) * 65]);
    }
  }
  if (points.length === 1) points.push([620, 82]);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const labels = [1, 7, 14, 21, days]
    .filter((d, i, a) => d <= days && a.indexOf(d) === i)
    .map(
      (d) =>
        `${new Date(Date.UTC(year, monthNumber - 1, d)).toLocaleDateString("en-IN", { month: "short" })} ${String(d).padStart(2, "0")}`,
    );
  const lastX = points.at(-1)[0];
  return { line, labels, lastX };
}
export function donutGradient(categories) {
  const total = categories.reduce((s, c) => s + c.amountPaise, 0) || 1;
  let cursor = 0;
  const stops = categories.slice(0, 5).map((c, i) => {
    const from = cursor;
    cursor += (c.amountPaise / total) * 100;
    return `${colors[i]} ${from}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(",")})`;
}
export function categoryEmoji(s) {
  return s.includes("Food")
    ? "\u25C9"
    : s.includes("Transport")
      ? "\u2197"
      : s.includes("Subscriptions")
        ? "\u25A3"
        : s.includes("Bill")
          ? "\u03DF"
          : s.includes("Grocer")
            ? "\u2667"
            : "\u25C8";
}
