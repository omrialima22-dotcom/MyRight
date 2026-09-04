import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

const SCHEMA = {
  type: "object",
  properties: {
    shared_documents: {
      type: "array",
      description: "מסמכים משותפים הנדרשים עבור יותר מכיסוי אחד (כל אחד נדרש פעם אחת)",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          category: { type: "string", enum: ["required", "recommended"] }
        },
        required: ["text", "category"]
      }
    },
    per_coverage: {
      type: "array",
      description: "מסמכים הייחודיים לכיסוי מסוים (לא משותפים)",
      items: {
        type: "object",
        properties: {
          coverage_name: { type: "string" },
          documents: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                category: { type: "string", enum: ["required", "recommended"] }
              },
              required: ["text", "category"]
            }
          }
        },
        required: ["coverage_name", "documents"]
      }
    },
    doctor_request: { type: "string", description: "מסמך מאורגן אחד לרופא, עם סעיף לכל כיסוי, המבקש אישור של עובדות רפואיות/תפקודיות בלבד" },
    claim_letter: { type: "string", description: "מכתב תביעה מרוכז לחברת הביטוח המתייחס לכל הכיסויים ולסעיפים הרלוונטיים" }
  },
  required: ["shared_documents", "per_coverage", "doctor_request", "claim_letter"]
};

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
    const { insurer, policy_type, coverages } = body;
    if (!Array.isArray(coverages) || coverages.length === 0) {
      return Response.json({ error: 'חסרים כיסויים להכנת החבילה' }, { status: 400 });
    }

    const coverageBlock = coverages.map((c, i) => ({
      name: c.name || `כיסוי ${i + 1}`,
      benefit: c.benefit || '',
      conditions: c.conditions || '',
      source_clause: c.source_clause || '',
      source_page: c.source_page ?? null,
      policy_requirements: c.policy_requirements || '',
      relevance_reason: c.relevance_reason || '',
      eligibility_summary: c.eligibility_summary || '',
      user_answers: c.user_answers || []
    }));

    const prompt = [
      buildSystemPrompt("אתה מכין חבילת תביעה מרוכזת אחת לחברת ביטוח, הכוללת מספר כיסויים שעשויים להיות רלוונטיים."),
      "",
      `חברת ביטוח: ${insurer || 'לא צוין'}`,
      `סוג ביטוח: ${policy_type || 'לא צוין'}`,
      "",
      "--- הכיסויים שעשויים להיות רלוונטיים ---",
      JSON.stringify(coverageBlock, null, 2),
      "",
      "משימות:",
      "1. shared_documents: מסמכים שנדרשים עבור יותר מכיסוי אחד (למשל פוליסה, תעודת זהות, סיכום רפואי כללי). כל אחד יופיע פעם אחת בלבד.",
      "2. per_coverage: מסמכים ייחודיים לכיסוי מסוים שלא נכללו במשותפים (למשל אישור אבחנה למחלות קשות, אישור תפקודי לסיעוד).",
      "3. doctor_request: מסמך אחד מסודר לרופא. בראשו הסבר קצר: 'יש כמה פרטים רפואיים שאנחנו צריכים להשלים לצורך בדיקת התביעה.' ואז סעיף נפרד לכל כיסוי. בקש מהרופא לאשר רק עובדות רפואיות או תפקודיות שהוא יכול לאמת (תקופה, מצב, רמת תפקוד, צורך בעזרה). אל תבקש ממנו לקבוע שהמטופל 'זכאי' או 'סיעודי'.",
      "4. claim_letter: מכתב תביעה רשמי אחד לחברת הביטוח המתייחס לכל הכיסויים, מפנה מפורשות לסעיפים הרלוונטיים, ומצרף רשימת מסמכים. טון ענייני.",
      "",
      "כללים:",
      "- אל תבקש את אותו מסמך פעמיים. אם מסמך משותף למספר כיסויים — הכנס אותו ל-shared_documents בלבד.",
      "- מסמך ב-per_coverage חייב להיות ייחודי לאותו כיסוי.",
      "- אל תמציא מסמכים שלא נובעים מתנאי הכיסוי או מהליך התביעה הרגיל.",
      "- כל הטקסטים בעברית פשוטה וברורה. סכומים בשקלים בלבד."
    ].join("\n");

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: SCHEMA,
      model: 'claude-sonnet-5'
    });

    const data = safeObj(result, { shared_documents: [], per_coverage: [], doctor_request: '', claim_letter: '' });

    return Response.json({
      shared_documents: Array.isArray(data.shared_documents) ? data.shared_documents : [],
      per_coverage: Array.isArray(data.per_coverage) ? data.per_coverage : [],
      doctor_request: data.doctor_request || '',
      claim_letter: data.claim_letter || ''
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}