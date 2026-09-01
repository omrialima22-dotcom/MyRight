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
    const { claim_title, claim_description, policy_type } = body;
    if (!claim_title || !claim_description) {
      return Response.json({ error: 'חובה לציין כותרת ותיאור לתביעה' }, { status: 400 });
    }

    const prompt = `${buildSystemPrompt('אתה מכין צ\'קליסט פעולות ומסמכים להגשת תביעת ביטוח.')}

פרטי התביעה:
- כותרת: ${claim_title}
- תיאור המקרה: ${claim_description}
- סוג ביטוח: ${POLICY_TYPE_LABELS[policy_type] || policy_type || 'לא צוין'}

צור רשימה מסודרת של פעולות ומסמכים שהמשתמש צריך לאסוף או לבצע כדי להגיש את התביעה. כל פריט צריך להיות פשוט, ברור ומנוסח בעברית יומיומית. כלול גם פעולות פרקטיות (למשל: לאסוף קבלות, לקבל אישור רופא, לצלם נזק) וגם מסמכים רלוונטיים.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['items']
      },
      model: 'automatic'
    });

    const items = Array.isArray(result?.items) ? result.items : [];
    const checklist = items.map((text) => ({ text, done: false }));
    return Response.json({ checklist });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}