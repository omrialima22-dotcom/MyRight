import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

const POLICY_TYPE_LABELS = {
  health: 'ביטוח בריאות',
  life: 'ביטוח חיים',
  car: 'ביטוח רכב',
  home: 'ביטוח דירה/מבנה',
  travel: 'ביטוח נסיעות',
  disability: 'ביטוח אובדן כושר עבודה',
  other: 'ביטוח אחר'
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      claim_title, claim_description, policy_type,
      coverage_name, coverage_conditions, source_clause, policy_requirements, eligibility_summary
    } = body;
    if (!claim_title || !claim_description) {
      return Response.json({ error: 'חובה לציין כותרת ותיאור לתביעה' }, { status: 400 });
    }

    const coverageBlock = coverage_name
      ? [
          "הכיסוי הרלוונטי שנמצא בפוליסה:",
          `- שם הכיסוי: ${coverage_name}`,
          coverage_conditions ? `- תנאי הכיסוי: ${coverage_conditions}` : '',
          source_clause ? `- סעיף מקור: ${source_clause}` : '',
          policy_requirements ? `- דרישות הפוליסה (פשוט): ${policy_requirements}` : '',
          eligibility_summary ? `- סיכום הזכאות האפשרית: ${eligibility_summary}` : ''
        ].filter(Boolean).join("\n")
      : "";

    const prompt = `${buildSystemPrompt("אתה מכין צ'קליסט מסמכים ופעולות להגשת תביעת ביטוח, מבוסס על הפוליסה והכיסוי הרלוונטי.")}

פרטי התביעה:
- כותרת: ${claim_title}
- תיאור המקרה: ${claim_description}
- סוג ביטוח: ${POLICY_TYPE_LABELS[policy_type] || policy_type || 'לא צוין'}

${coverageBlock}

צור רשימה של פעולות ומסמכים. לכל פריט ציין קטגוריה:
- "required" = נדרש לפי הפוליסה / להגשת התביעה (מבוסס על תנאי הכיסוי וסעיפי הפוליסה).
- "recommended" = מומלץ לצרף כדי לחזק ולהבהיר את התביעה (לא חובה).

כללים:
- אל תמציא מסמך נדרש שלא נובע מהפוליסה או מהליך התביעה הרגיל.
- אם מסמך נדרש מופיע מפורשות בתנאי הכיסוי, ציין זאת כ-required.
- כל פריט בעברית פשוטה וברורה.
- כלול לפחות: טופס תביעה של חברת הביטוח, וכל מסמך שתנאי הכיסוי מחייבים.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                category: { type: 'string', enum: ['required', 'recommended'] }
              },
              required: ['text', 'category']
            }
          }
        },
        required: ['items']
      },
      model: 'claude-sonnet-5'
    });

    const raw = Array.isArray(result?.items) ? result.items : [];
    const checklist = raw.map((it) => {
      if (typeof it === 'string') return { text: it, category: 'required', done: false };
      return {
        text: it.text || '',
        category: it.category === 'recommended' ? 'recommended' : 'required',
        done: false
      };
    });
    return Response.json({ checklist });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}