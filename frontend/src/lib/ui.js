// Shared Tailwind class strings, so repeated elements stay consistent.

export const card = "rounded-[10px] border border-line bg-white px-[18px] py-[17px]";
export const cardTitle = "m-0 font-display text-xs font-bold tracking-[-0.2px]";
export const cardSubtitle = "mt-[5px] text-[9px] text-[#939d97]";
export const kicker = "mb-2 flex items-center gap-[5px] text-[8px] font-bold tracking-[1px] text-[#559270]";
export const listRow = "flex items-center gap-3 border-t border-line-soft px-0.5 py-3.5";
export const emptyState = "p-8 text-center text-[10px] text-[#929d95]";
export const noticeInline =
  "mt-[13px] flex items-center gap-2 rounded-[7px] bg-[#edf5ef] px-[13px] py-[11px] text-[9px] text-[#5f7b68]";

const button = "flex items-center justify-center gap-[7px] rounded-[7px] border font-bold";
export const primaryBtn = `${button} border-brand-600 bg-brand-600 px-[13px] py-2.5 text-[9px] text-white hover:bg-brand-700`;
export const secondaryBtn = `${button} border-[#e3e9e4] bg-white px-[13px] py-2.5 text-[9px] text-[#66736b]`;
export const outlineBtn =
  "flex items-center gap-[7px] rounded-[7px] border border-[#e0e6e1] bg-white text-[#4f5b54] font-semibold hover:border-[#95bea5]";

/** Icon tile colours for category rows, by position. */
export const categoryTones = [
  "bg-mint text-[#51906b]",
  "bg-[#f0f3e9] text-[#81964b]",
  "bg-[#edf1fa] text-[#7183b3]",
  "bg-[#fbf2e8] text-[#b8874d]",
  "bg-[#f5edf5] text-[#a479a5]",
];
/** Icon tile colours for bill rows, by position. */
export const billTones = ["bg-[#eff4ea] text-[#8a9c62]", "bg-[#edf2f9] text-[#7086b7]", "bg-[#f5edf5] text-[#9d79a4]"];
