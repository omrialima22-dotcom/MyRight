// Hebrew-first formatting and label helpers for MyRight.

export const policyTypeLabels = {
  health: "ביטוח בריאות",
  life: "ביטוח חיים",
  car: "ביטוח רכב",
  home: "ביטוח דירה",
  travel: "ביטוח נסיעות",
  disability: "אובדן כושר עבודה",
  other: "אחר"
};

export const policyTypeOptions = [
  { value: "health", label: "ביטוח בריאות" },
  { value: "life", label: "ביטוח חיים" },
  { value: "car", label: "ביטוח רכב" },
  { value: "home", label: "ביטוח דירה" },
  { value: "travel", label: "ביטוח נסיעות" },
  { value: "disability", label: "אובדן כושר עבודה" },
  { value: "other", label: "אחר" }
];

export const claimStatusLabels = {
  draft: "טיוטה",
  preparing: "בהכנה",
  submitted: "הוגשה",
  approved: "אושרה",
  rejected: "נדחתה"
};

export const claimStatusColors = {
  draft: "bg-slate-100 text-slate-600",
  preparing: "bg-amber-100 text-amber-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700"
};

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatCurrency(amount) {
  if (amount == null || amount === "" || isNaN(Number(amount))) return "—";
  return `${Number(amount).toLocaleString("he-IL")} ₪`;
}