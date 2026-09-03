// Pure helpers for the Live Analysis experience.
// IMPORTANT: every value here is DERIVED from real saved policy data.
// Nothing is fabricated or timer-driven.

export const STAGES = [
  { key: "received", label: "הפוליסות התקבלו" },
  { key: "reading", label: "קוראים את המסמכים" },
  { key: "coverages", label: "מזהים את הכיסויים" },
  { key: "matching", label: "משווים למה שסיפרת לנו" },
  { key: "checking", label: "בודקים מה עוד כדאי לבדוק" }
];

// The current engine implements stages up to 'coverages'. 'matching' and 'checking'
// depend on the user's intake story and are a separate (future) phase — they are
// NEVER marked done by this screen, because that work has not happened yet.
const STEP_ORDER = ["received", "reading", "coverages", "matching", "checking"];

function isDone(status) {
  return status === "success" || status === "unreadable" || status === "failed";
}

export function allComplete(policies) {
  return policies.length > 0 && policies.every((p) => isDone(p.extraction_status));
}

export function hasFailures(policies) {
  return policies.some(
    (p) => p.extraction_status === "unreadable" || p.extraction_status === "failed"
  );
}

// Overall stage key derived from real policy state.
export function deriveStage(policies) {
  if (!policies || policies.length === 0) return "received";
  if (allComplete(policies)) return "complete";
  const anyCoverages = policies.some((p) => (p.coverages || []).length > 0);
  const anyRead = policies.some(
    (p) => (p.document_sections || []).length > 0 || p.policy_metadata
  );
  if (anyCoverages || anyRead) return "coverages";
  return "reading";
}

// Map overall stage to per-step states: 'done' | 'active' | 'pending'.
export function progressStates(stage) {
  const reached = stage === "complete" ? "coverages" : stage === "received" ? "received" : stage;
  const reachedIndex = STEP_ORDER.indexOf(reached);
  return STAGES.map((s, i) => {
    if (stage === "complete") {
      return { ...s, state: i <= reachedIndex ? "done" : "pending" };
    }
    if (i < reachedIndex) return { ...s, state: "done" };
    if (i === reachedIndex) return { ...s, state: "active" };
    return { ...s, state: "pending" };
  });
}

// Build a list of REAL discoveries from saved policy data. Order matters: each item
// appears only once its underlying data actually exists in the saved record.
export function deriveDiscoveries(policies) {
  const items = [];
  policies.forEach((p) => {
    const meta = p.policy_metadata || {};
    if (meta.insurerName) {
      items.push({
        key: `insurer-${p.id}`,
        kind: "insurer",
        label: "זיהינו את חברת הביטוח",
        value: meta.insurerName,
        policyId: p.id
      });
    }
    const typeVal = meta.policyName || meta.policyType;
    if (typeVal) {
      items.push({
        key: `type-${p.id}`,
        kind: "type",
        label: "זיהינו את סוג הביטוח",
        value: typeVal,
        policyId: p.id
      });
    }
    if (meta.insurancePeriod) {
      items.push({
        key: `period-${p.id}`,
        kind: "period",
        label: "תקופת הביטוח",
        value: meta.insurancePeriod,
        policyId: p.id
      });
    }
    (p.coverages || []).forEach((c, i) => {
      const source = {
        policyId: p.id,
        page: c.sourcePage,
        clause: c.sourceClause,
        sourceText: c.sourceText
      };
      items.push({
        key: `cov-${p.id}-${i}`,
        kind: "coverage",
        label: "מצאנו כיסוי",
        value: c.name || "כיסוי",
        sub: c.benefit || "",
        source
      });
      if (c.waitingPeriod) {
        items.push({
          key: `wait-${p.id}-${i}`,
          kind: "waiting",
          label: "נמצאה תקופת המתנה",
          value: c.waitingPeriod,
          source
        });
      }
      if (c.conditions) {
        items.push({
          key: `cond-${p.id}-${i}`,
          kind: "condition",
          label: "מצאנו תנאי חשוב",
          value: c.conditions,
          source
        });
      }
    });
  });
  return items;
}

export function countCoverages(policies) {
  return policies.reduce((n, p) => n + (p.coverages || []).length, 0);
}
export function countChecked(policies) {
  return policies.filter((p) => p.extraction_status === "success").length;
}
export function countFailed(policies) {
  return policies.filter(
    (p) => p.extraction_status === "unreadable" || p.extraction_status === "failed"
  ).length;
}

// Per-policy display, driven by real identified data only.
export function policyDisplayLabel(p, index) {
  const meta = p.policy_metadata || {};
  if (meta.insurerName) return meta.insurerName;
  if (p.insurance_company && p.insurance_company.indexOf("טרם זוהה") < 0) {
    return p.insurance_company;
  }
  return `פוליסה ${index + 1}`;
}

export function policyStepState(p) {
  const status = p.extraction_status;
  if (status === "success") return "done";
  if (status === "unreadable" || status === "failed") return "failed";
  if ((p.document_sections || []).length > 0 || p.policy_metadata) return "active";
  if (status === "processing") return "active";
  return "waiting";
}