import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

// =============================================================================
// Deterministic eligibility engine.
//
// Two modes:
//  - FREEZE mode  (no `requirements` in input): one LLM pass BEFORE question 1
//    builds the frozen requirement graph (facts classified POLICY/USER/DERIVED,
//    conditional children predeclared, policy facts pre-resolved, known user
//    facts mapped from the event). Returns the frozen graph.
//  - RECALC mode (`requirements` in input): pure deterministic, ZERO LLM.
//    Resolves user/policy facts, computes DERIVED facts with code, activates/
//    deactivates predeclared conditionals, computes pending USER questions and
//    coverage statuses. The factKey set is frozen → the questionnaire always
//    converges and terminates.
// =============================================================================

// ---------- Deterministic helpers ----------

function safeObj(result, fallback) {
  if (result && typeof result === 'object') return result;
  if (typeof result === 'string') { try { return JSON.parse(result); } catch { return fallback; } }
  return fallback;
}

function parseDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); // DD/MM/YYYY
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // YYYY-MM-DD
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

// An answer that expresses uncertainty is NOT a "no". It must never fail a
// coverage — it only means we still don't know.
const UNCERTAIN_PATTERNS = ['לא בטוח', 'לא בטוחה', 'לא יודע', 'לא יודעת', 'לא זוכר', 'לא זוכרת', 'אולי', 'לא ידוע', 'לא רלוונטי לי'];

function isUncertain(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  if (!s) return false;
  return UNCERTAIN_PATTERNS.some((p) => s.includes(p));
}

function normalizeBool(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (isUncertain(s)) return null;
  if (['yes', 'true', '1'].includes(s)) return 'true';
  if (['no', 'false', '0'].includes(s)) return 'false';
  // Hebrew answers often arrive as a full phrase ("כן, אושפזתי לשבועיים").
  if (/^כן\b/.test(s) || /^כן[,\s.–-]/.test(s) || s === 'כן') return 'true';
  if (/^לא\b/.test(s) || /^לא[,\s.–-]/.test(s) || s === 'לא') return 'false';
  return null;
}

// Extract a day count from free text: "90", "90 ימים", "3 חודשים", "שנה".
function parseDays(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  const n = Number(s);
  if (!isNaN(n) && s !== '') return n;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) {
    if (/שנה/.test(s)) return 365;
    if (/חודש/.test(s)) return 30;
    return null;
  }
  const num = Number(m[1]);
  if (/שנ/.test(s)) return num * 365;
  if (/חוד/.test(s)) return num * 30;
  if (/שבוע/.test(s)) return num * 7;
  return num;
}

function condEq(a, b) {
  const na = normalizeBool(a), nb = normalizeBool(b);
  if (na != null && nb != null) return na === nb;
  const sa = String(a ?? '').trim().toLowerCase();
  const sb = String(b ?? '').trim().toLowerCase();
  if (sa === sb) return true;
  // Tolerate phrasing differences ("כן, במשך חודשיים" vs "כן").
  if (sa && sb && (sa.startsWith(sb) || sb.startsWith(sa))) return true;
  return false;
}

function factValueMap(facts) {
  const map = {};
  (facts || []).forEach((f) => {
    if (f && f.fact_key != null && f.value != null && f.value !== '') map[f.fact_key] = f.value;
  });
  return map;
}

// Evaluate a predeclared activation condition: "fact_key==value" | "fact_key!=value"
// | "fact_key" (truthy) | empty (always active).
function evalCondition(cond, values) {
  if (!cond || !String(cond).trim()) return true;
  const s = String(cond).trim();
  let m = s.match(/^([a-zA-Z0-9_]+)\s*==\s*(.+)$/);
  if (m) return condEq(values[m[1]], m[2].trim());
  m = s.match(/^([a-zA-Z0-9_]+)\s*!=\s*(.+)$/);
  if (m) return !condEq(values[m[1]], m[2].trim());
  m = s.match(/^([a-zA-Z0-9_]+)$/);
  if (m) {
    const v = values[m[1]];
    return normalizeBool(v) === 'true';
  }
  return true;
}

// Heuristic fallback: if the LLM omitted derive_params, infer fact references
// from depends_on using naming conventions. Best-effort; keeps the derived fact
// computable (and the coverage evaluable) without ever asking the user.
function inferParams(req) {
  const p = req.derive_params || {};
  const deps = req.depends_on || [];
  const find = (pred) => deps.find((d) => pred(d));
  const eventDate = () => p.date_fact || find((d) => /diagnos|incident|event|treatment|symptom/.test(d)) || find((d) => /date$/.test(d) && !/start|end/.test(d));
  if (req.derive === 'date_after_offset') {
    return {
      date_fact: eventDate(),
      base_fact: p.base_fact || find((d) => /start|policy_start/.test(d)),
      offset_fact: p.offset_fact || find((d) => /waiting|period|offset/.test(d)),
      offset_days: p.offset_days
    };
  }
  if (req.derive === 'date_in_range') {
    return {
      date_fact: eventDate(),
      start_fact: p.start_fact || find((d) => /start/.test(d)),
      end_fact: p.end_fact || find((d) => /end/.test(d))
    };
  }
  if (req.derive === 'days_between_gte') {
    return {
      from_fact: p.from_fact || deps[0],
      to_fact: p.to_fact || deps[1],
      min_days: p.min_days
    };
  }
  return p;
}

function computeDerived(req, values) {
  const p = inferParams(req);
  switch (req.derive) {
    case 'date_after_offset': {
      const date = parseDate(values[p.date_fact]);
      const base = parseDate(values[p.base_fact]);
      if (!date || !base) return null;
      let offset = null;
      if (p.offset_fact != null && values[p.offset_fact] != null) offset = parseDays(values[p.offset_fact]);
      else if (p.offset_days != null) offset = parseDays(p.offset_days);
      if (offset == null || isNaN(offset)) return null;
      const threshold = new Date(base.getTime() + offset * 86400000);
      return date >= threshold ? 'true' : 'false';
    }
    case 'date_in_range': {
      const date = parseDate(values[p.date_fact]);
      const start = parseDate(values[p.start_fact]);
      const end = parseDate(values[p.end_fact]);
      if (!date || !start || !end) return null;
      return (date >= start && date <= end) ? 'true' : 'false';
    }
    case 'days_between_gte': {
      const from = parseDate(values[p.from_fact]);
      const to = parseDate(values[p.to_fact]);
      if (!from || !to) return null;
      const min = Number(p.min_days);
      if (isNaN(min)) return null;
      const days = (to.getTime() - from.getTime()) / 86400000;
      return days >= min ? 'true' : 'false';
    }
    default:
      return null;
  }
}

// An `expected` value may only reject a coverage when it is genuinely comparable:
// a yes/no expectation, or a computed DERIVED_FACT (true/false). Dates and free
// text can never be rejected by string equality — that produced false
// "not relevant" results (e.g. a real diagnosis_date compared to a phrase).
function isComparableExpectation(r) {
  const exp = r.expected;
  if (exp == null || String(exp).trim() === '') return false;
  if (r.answer_type === 'date' || /_date$/.test(String(r.fact_key || ''))) return false;
  if (r.fact_type === 'DERIVED_FACT') return true;
  return normalizeBool(exp) != null;
}

function isAnswered(values, key) {
  return values[key] != null && values[key] !== '';
}

// Resolved = answered AND not an uncertain answer.
function isResolved(values, key) {
  return isAnswered(values, key) && !isUncertain(values[key]);
}

// Resolve the full fact value map: seed policy facts + user facts, then compute
// derived facts iteratively (derived may depend on other derived).
function resolveAll(requirements, inputFacts) {
  const values = factValueMap(inputFacts);
  requirements.forEach((r) => {
    if (r.fact_type === 'POLICY_FACT' && r.value != null && values[r.fact_key] == null) {
      values[r.fact_key] = r.value;
    }
  });
  let changed = true, guard = 0;
  while (changed && guard < 8) {
    changed = false; guard++;
    requirements.forEach((r) => {
      if (r.fact_type === 'DERIVED_FACT' && !isResolved(values, r.fact_key)) {
        const v = computeDerived(r, values);
        if (v != null) { values[r.fact_key] = v; changed = true; }
      }
    });
  }
  return values;
}

// Pending USER facts = active (condition true) & unresolved & deduped by key.
function buildPending(requirements, values) {
  const seen = {};
  const pending = [];
  requirements.forEach((r) => {
    if (r.fact_type !== 'USER_FACT') return;
    if (seen[r.fact_key]) return;
    if (!evalCondition(r.condition, values)) return;     // inactive conditional
    if (isAnswered(values, r.fact_key)) return;          // already answered (incl. "לא בטוח") — never re-ask
    seen[r.fact_key] = true;
    pending.push(r);
  });
  return pending;
}

function coverageStatuses(requirements, values) {
  const byCov = {};
  requirements.forEach((r) => {
    (r.coverage_keys || []).forEach((k) => {
      (byCov[k] = byCov[k] || []).push(r);
    });
  });
  return Object.keys(byCov).map((k) => {
    const reqs = byCov[k];
    let notRelevant = false;
    let reason = '';
    const missing = [];
    let allResolved = true;
    reqs.forEach((r) => {
      if (!evalCondition(r.condition, values)) return; // inactive conditional ignored
      if (!isResolved(values, r.fact_key)) {
        allResolved = false;
        if (isUncertain(values[r.fact_key])) {
          // Uncertainty is not a rejection — it stays an open item to verify.
          missing.push(r.fact_key);
          reason = reason || 'צריך לוודא פרט אחד כדי לדעת אם זה רלוונטי';
        } else if (r.fact_type === 'USER_FACT') {
          missing.push(r.fact_key);
        } else if (r.fact_type === 'POLICY_FACT') {
          missing.push(r.fact_key);
          reason = reason || 'חסר נתון מהפוליסה — יש לאמת אותו במסמך';
        } else {
          reason = reason || 'חסר נתון שנדרש כדי להשלים את החישוב';
        }
      } else if (isComparableExpectation(r) && !condEq(values[r.fact_key], r.expected)) {
        notRelevant = true;
        reason = reason || 'לפי מה שמסרת, התנאי שהפוליסה דורשת לכיסוי הזה לא מתקיים';
      }
    });
    let status = 'unknown';
    if (notRelevant) status = 'not_relevant';
    else if (allResolved) status = 'potential';
    return { key: k, status, explanation: reason, missing_fact_keys: missing };
  });
}

function pendingAsQuestions(pending) {
  return pending.map((r) => ({
    fact_key: r.fact_key,
    prompt: r.prompt || r.fact_key,
    answer_type: r.answer_type || 'text',
    options: Array.isArray(r.options) ? r.options : [],
    fact_type: 'USER_FACT',
    coverage_keys: r.coverage_keys || [],
    activated_by: r.condition ? 'conditional' : 'always',
    in_frozen_graph: true
  }));
}

function buildResult(requirements, inputFacts) {
  const values = resolveAll(requirements, inputFacts);
  const pending = buildPending(requirements, values);
  const statuses = coverageStatuses(requirements, values);
  const derived = {};
  requirements.forEach((r) => {
    if (r.fact_type === 'DERIVED_FACT' && isResolved(values, r.fact_key)) derived[r.fact_key] = values[r.fact_key];
  });
  return {
    questions: pendingAsQuestions(pending),
    coverages: statuses,
    derived_facts: derived,
    complete: pending.length === 0,
    debug: {
      mode: 'deterministic',
      frozen: true,
      resolved_count: Object.keys(values).filter((k) => isResolved(values, k)).length,
      pending_count: pending.length
    }
  };
}

// ---------- LLM freeze pass (before question 1) ----------

const FREEZE_SCHEMA = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      description: "גרף הדרישות הקנוני והקפוא לכל הכיסויים. כל דרישה מסווגת לסוג עובדה.",
      items: {
        type: "object",
        properties: {
          fact_key: { type: "string", description: "מפתח קנוני יציב באנגלית, למשל diagnosis_date, hospitalization_occurred, policy_start_date, waiting_period_days, diagnosis_after_waiting_period" },
          fact_type: { type: "string", enum: ["POLICY_FACT", "USER_FACT", "DERIVED_FACT"] },
          coverage_keys: { type: "array", items: { type: "string" }, description: "מפתחות הכיסויים שדרישה זו רלוונטית אליהם" },
          prompt: { type: "string", description: "רק ל-USER_FACT: שאלה עובדתית פשוטה בעברית שרק המשתמש יכול לענות עליה" },
          answer_type: { type: "string", enum: ["quick", "text", "date"] },
          options: { type: "array", items: { type: "string" } },
          depends_on: { type: "array", items: { type: "string" }, description: "מפתחות עובדות שתלויה בהן (המשך מותנה או נגזרת)" },
          condition: { type: "string", description: "תנאי הפעלה לעובדה מותנית בצורה fact_key==value (למשל hospitalization_occurred==כן), או ריק אם תמיד פעילה" },
          expected: { type: "string", description: "הערך הנדרש כדי שהכיסוי יחשב פוטנציאלי (למשל כן / true), או ריק אם אין תנאי מעבר/כשל ברור" },
          derive: { type: "string", enum: ["date_after_offset", "date_in_range", "days_between_gte"], description: "רק ל-DERIVED_FACT: סוג הנגזרת" },
          derive_params: {
            type: "object",
            description: "פרמטרים לנגזרת. חובה למלא כדי שהנגזרת תחושב. date_after_offset: {date_fact, base_fact, offset_fact או offset_days}. date_in_range: {date_fact, start_fact, end_fact}. days_between_gte: {from_fact, to_fact, min_days}. כל הערכים הם מפתחות עובדה מ-requirements, חוץ מ-offset_days/min_days שהם מספרים.",
            properties: {
              date_fact: { type: "string" },
              base_fact: { type: "string" },
              start_fact: { type: "string" },
              end_fact: { type: "string" },
              from_fact: { type: "string" },
              to_fact: { type: "string" },
              offset_fact: { type: "string" },
              offset_days: { type: "number" },
              min_days: { type: "number" }
            },
            additionalProperties: false
          },
          value: { type: "string", description: "רק ל-POLICY_FACT: הערך שחולץ מהפוליסה, או ריק אם לא ניתן לאמת" },
          policy_fact_needs_verification: { type: "boolean" }
        },
        required: ["fact_key", "fact_type", "coverage_keys"]
      }
    },
    known_user_facts: {
      type: "array",
      description: "עובדות משתמש שכבר עולות מתיאור האירוע או מהשאלון הראשוני (מאושרות, לא מסקנות).",
      items: {
        type: "object",
        properties: {
          fact_key: { type: "string" },
          value: { type: "string" },
          source: { type: "string", enum: ["user", "event"] }
        },
        required: ["fact_key", "value", "source"]
      }
    }
  },
  required: ["requirements"]
};

const FREEZE_RULES = [
  "אתה בונה את גרף הדרישות הקפוא לבדיקת זכאות — לפני שאלה ראשונה. הגרף נבנה פעם אחת וקופא.",
  "",
  "סיווג עובדות (קריטי):",
  "- POLICY_FACT: מידע שחייב להגיע מהפוליסה. דוגמאות: policy_start_date, policy_end_date, waiting_period_days, coverage_amount, qualification_period. מלא את value מתוך הפוליסה. אם לא ניתן לאמת — policy_fact_needs_verification=true ו-value ריק. לעולם אל תהפוך עובדת פוליסה לשאלת משתמש.",
  "- USER_FACT: מידע שרק המשתמש יכול לאשר על האירוע שלו. דוגמאות: diagnosis_date, treatment_received, hospitalization_occurred, needed_help_bathing, needed_help_dressing, symptom_start_date. רק אלה הופכות לשאלות.",
  "- DERIVED_FACT: מידע ש-MyRight יכול לחשב מעובדות אחרות. דוגמאות: diagnosis_after_waiting_period, treatment_within_coverage_period, policy_active_on_event_date. לעולם אל תשאל את המשתמש על עובדה נגזרת — חשב אותה בקוד.",
  "",
  "אסור לשאול את המשתמש:",
  '- אל תיצור USER_FACT ל"מהו תאריך תחילת הביטוח" / "מהי תקופת ההמתנה" — אלה POLICY_FACT.',
  '- אל תיצור USER_FACT ל"האם האבחנה הייתה לאחר תקופת האכשרה" / "האם האירוע התרחש בתוקף הפוליסה" / "האם חלפו 90 ימים" — אלה DERIVED_FACT עם derive + derive_params.',
  "",
  "נגזרות (derive):",
  "- date_after_offset: האם date_fact הוא לאחר base_fact + offset (offset_fact או offset_days). למשל diagnosis_after_waiting_period = date_after_offset { date_fact: diagnosis_date, base_fact: policy_start_date, offset_fact: waiting_period_days }.",
  "- date_in_range: האם date_fact בין start_fact ל-end_fact. למשל policy_active_on_event_date = date_in_range { date_fact: incident_date, start_fact: policy_start_date, end_fact: policy_end_date }.",
  "- days_between_gte: האם מספר הימים מ-from_fact ל-to_fact לפחות min_days.",
  "",
  "המשכים מותנים (מוקדמים מראש):",
  "- ילד מותנה חייב להיות מוקדם כאן עם depends_on + condition, למשל hospitalization_duration עם condition='hospitalization_occurred==כן'. אל תמציא אותו אחר כך.",
  "",
  "דה-דופליקציה:",
  "- אותה עובדה = אותו fact_key, וב-coverage_keys רשום את כל הכיסויים שזקוקים לה. אל תשכפל עובדות.",
  "- אל תמזג עובדות שונות רק בגלל דמיון.",
  "",
  "expected: מלא רק כשיש תנאי מעבר/כשל ברור (למשל hospitalization_occurred expected='כן' בכיסוי שדורש אשפוז; diagnosis_after_waiting_period expected='true').",
  "",
  "known_user_facts: מפה מתיאור האירוע/השאלון רק עובדות שמופיעות מפורשות (לא מסקנות, לא ניחושים).",
  "",
  "כל הטקסטים בעברית. לעולם אל תקבע זכאות ('מגיע לך', 'אתה זכאי')."
].join("\n");

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { requirements, facts } = body;

    // ---------- Deterministic RECALC mode (per answer, ZERO LLM) ----------
    if (Array.isArray(requirements) && requirements.length > 0) {
      const result = buildResult(requirements, facts || []);
      return Response.json(result);
    }

    // ---------- LLM FREEZE mode (before question 1) ----------
    const { coverages, event_summary, event_story, event_answers } = body;
    if (!Array.isArray(coverages) || coverages.length === 0) {
      return Response.json({ error: 'חסרים כיסויים' }, { status: 400 });
    }

    const coverageBlock = coverages.map((c) => ({
      key: c.key,
      name: c.coverage_name || '',
      benefit: c.benefit || '',
      conditions: c.conditions || '',
      source_clause: c.source_clause || '',
      source_page: c.source_page ?? null,
      relevance_reason: c.relevance_reason || '',
      policy_requirements: c.policy_requirements || ''
    }));

    const eventBlock = [
      "--- תיאור האירוע ---",
      event_story || "(לא סופק)",
      event_summary ? ("\nסיכום: " + event_summary) : "",
      (event_answers && event_answers.length)
        ? "--- שאלות ותשובות מהשאלון הראשוני ---\n" + event_answers.map(a => `ש: ${a.question}\nת: ${a.answer}`).join("\n")
        : ""
    ].join("\n");

    const prompt = [
      buildSystemPrompt("אתה בונה את גרף הדרישות הקפוא לבדיקת זכאות ביטוחית."),
      "",
      eventBlock,
      "",
      "--- הכיסויים שעשויים להיות רלוונטיים (עם מפתחות) ---",
      JSON.stringify(coverageBlock, null, 2),
      "",
      FREEZE_RULES
    ].join("\n");

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: FREEZE_SCHEMA,
      model: 'claude-sonnet-5'
    });

    const data = safeObj(result, { requirements: [], known_user_facts: [] });
    const reqs = Array.isArray(data.requirements) ? data.requirements : [];
    const known = Array.isArray(data.known_user_facts) ? data.known_user_facts : [];

    // Freeze marker.
    const frozenRequirements = reqs.map((r) => ({
      ...r,
      fact_type: r.fact_type || 'USER_FACT',
      coverage_keys: Array.isArray(r.coverage_keys) ? r.coverage_keys : [],
      depends_on: Array.isArray(r.depends_on) ? r.depends_on : [],
      in_frozen_graph: true,
      frozen_at: new Date().toISOString()
    }));

    const resolved = buildResult(frozenRequirements, known);

    return Response.json({
      requirements: frozenRequirements,
      known_user_facts: known,
      questions: resolved.questions,
      coverages: resolved.coverages,
      derived_facts: resolved.derived_facts,
      complete: resolved.complete,
      debug: { mode: 'freeze', frozen: true, ...resolved.debug }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}