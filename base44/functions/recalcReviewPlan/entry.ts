import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

const SCHEMA = {
  type: "object",
  properties: {
    known_facts: {
      type: "array",
      description: "העובדות שכבר ידועות (מהאירוע או מתשובות המשתמש), עם מקור",
      items: {
        type: "object",
        properties: {
          fact_key: { type: "string" },
          value: { type: "string" },
          source: { type: "string", enum: ["user", "event"] }
        },
        required: ["fact_key", "value", "source"]
      }
    },
    questions: {
      type: "array",
      description: "השאלות העובדתיות שעדיין חסרות כעת כדי להעריך את הכיסויים — מבוטלות כפל לפי מפתח קנוני, כולל שאלות המשך מותנות שהתבטלו התנאי שלהן",
      items: {
        type: "object",
        properties: {
          fact_key: { type: "string", description: "מפתח קנוני יציב של העובדה" },
          prompt: { type: "string" },
          answer_type: { type: "string", enum: ["quick", "text", "date"] },
          options: { type: "array", items: { type: "string" } }
        },
        required: ["fact_key", "prompt", "answer_type"]
      }
    },
    coverages: {
      type: "array",
      description: "סטטוס עדכני לכל כיסוי על בסיס העובדות הידועות",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          status: { type: "string", enum: ["potential", "unknown", "not_relevant"] },
          explanation: { type: "string" },
          missing_fact_keys: { type: "array", items: { type: "string" } }
        },
        required: ["key", "status"]
      }
    }
  },
  required: ["known_facts", "questions", "coverages"]
};

const RULES = [
  "אתה מתכנן ומחשב בדיקת זכאות חכמה מול מספר כיסויים בפוליסות ביטוח.",
  "מטרה: לבנות תוכנית שאלות אחת משותפת לכל הכיסויים — ללא כפילויות — תוך שימוש חוזר בעובדות שכבר אושרו.",
  "",
  "כללים קריטיים:",
  "- עובדה מאושרת = תשובה מפורשת של המשתמש, או עובדה שמופיעה מפורשות בתיאור האירוע. אל תסיק מסקנות. אל תנחש. אל תשתמש בהיקש.",
  "- כל עובדה נדרשת מקבלת מפתח קנוני יציב (fact_key) באנגלית, למשל hospitalization_occurred, needed_help_dressing, diagnosis_date, treatment_start_date.",
  "- אותה עובדה = אותו מפתח, גם אם הניסוח שונה. דה-דופליקציה סמנטית: 'האם היית מאושפז?' ו-'האם הטיפולים כללו אשפוז?' הן אותה עובדה.",
  "- questions: רק עובדות שעדיין חסרות ונדרשות כעת. אל תכלול עובדה שכבר ב-known_facts. כל עובדה נשאלת פעם אחת בלבד.",
  "- שאלות המשך מותנות: כלול שאלת המשך רק אם העובדה-הורה כבר ידועה והתנאי דורש זאת. למשל 'כמה ימים נמשך האשפוז' רק אם hospitalization_occurred=yes ידוע. אם ההורה לא נענתה או שלילית — אל תכלול את ההמשך.",
  "- אל תמזג עובדות שונות רק בגלל דמיון. 'מוגבל בניידות' אינו בהכרח 'זקוק לעזרה לעבור ממיטה לכיסא'. אם שתי עובדות שונות נדרשות — שאל שתי שאלות. דיוק חשוב מהפחתת שאלות.",
  "- coverages.status: 'potential' אם העובדות הידועות מצביעות על רלוונטיות אפשרית (לעולם לא 'זכאי'), 'not_relevant' אם העובדות סותרות בבירור את הכיסוי, 'unknown' אם חסר מידע הכרחי כדי לקבוע.",
  "- missing_fact_keys: העובדות שעדיין חסרות לכיסוי זה (תת-קבוצה של השאלות הכלליות).",
  "- known_facts: מפה את כל העובדות הידועות. source='event' לעובדות שעולות מתיאור האירוע/התשובות, source='user' לעובדות שסופקו כמאושרות על ידי המשתמש.",
  "- options לשאלות quick: השתמש ב'כן / לא / לא בטוח / לא זוכר' כשמדובר בשאלת כן-לא. תמיד אפשר תשובה לא-ודאית כשהגיוני. תשובה לא-ודאית נשמרת ככזאת ולא הופכת ל'לא'.",
  "- כל הטקסטים בעברית. לעולם אל תקבע זכאות ('מגיע לך', 'אתה זכאי', 'מגיע לך כסף')."
].join("\n");

function safeObj(result, fallback) {
  if (result && typeof result === 'object') return result;
  if (typeof result === 'string') { try { return JSON.parse(result); } catch { return fallback; } }
  return fallback;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { coverages, facts, event_summary, event_story, event_answers } = body;
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

    const factsBlock = (Array.isArray(facts) && facts.length)
      ? "--- עובדות שכבר אושרו על ידי המשתמש ---\n" + facts.map((f) => `${f.fact_key} = ${f.value}`).join("\n")
      : "(אין עובדות מאושרות עדיין)";

    const eventBlock = [
      "--- תיאור האירוע ---",
      event_story || "(לא סופק)",
      event_summary ? ("\nסיכום: " + event_summary) : "",
      (event_answers && event_answers.length)
        ? "--- שאלות ותשובות מהשאלון הראשוני ---\n" + event_answers.map(a => `ש: ${a.question}\nת: ${a.answer}`).join("\n")
        : ""
    ].join("\n");

    const prompt = [
      buildSystemPrompt("אתה מתכנן בדיקת זכאות ביטוחית חכמה עם בסיס עובדות משותף."),
      "",
      eventBlock,
      "",
      factsBlock,
      "",
      "--- הכיסויים שעשויים להיות רלוונטיים ---",
      JSON.stringify(coverageBlock, null, 2),
      "",
      RULES
    ].join("\n");

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: SCHEMA,
      model: 'automatic'
    });

    const data = safeObj(result, { known_facts: [], questions: [], coverages: [] });

    // Ensure every coverage has a status entry.
    const covStatus = Array.isArray(data.coverages) ? data.coverages : [];
    const byKey = {};
    covStatus.forEach((c) => { if (c && c.key) byKey[c.key] = c; });
    const coveragesOut = coverages.map((c) => {
      const s = byKey[c.key] || {};
      return {
        key: c.key,
        status: s.status || "unknown",
        explanation: s.explanation || "",
        missing_fact_keys: Array.isArray(s.missing_fact_keys) ? s.missing_fact_keys : []
      };
    });

    return Response.json({
      known_facts: Array.isArray(data.known_facts) ? data.known_facts : [],
      questions: Array.isArray(data.questions) ? data.questions : [],
      coverages: coveragesOut
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}