import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { type, claim_title, claim_description, insurance_company, policy_number, incident_date, user_name } = body;
    if (!type || !claim_title || !claim_description) {
      return Response.json({ error: 'חסים פרטים ליצירת המכתב' }, { status: 400 });
    }

    const isDoctor = type === 'doctor';
    const task = isDoctor
      ? 'מכתב לרופא – בקשה מהרופא להכין מסמך רפואי שתומך בתביעת הביטוח. המכתב פונה לרופא בכבוד ומבקש ממנו לתעד את הממצאים, התאריכים והקשר לאירוע.'
      : 'מכתב תביעה רשמי לחברת הביטוח – המכתב פונה לחברת הביטוח, מציג את פרטי המקרה, מפרט את הבקשה לתשלום/כיסוי, ומצרף רשימת מסמכים. טון רשמי אך ברור ומנומס.';

    const prompt = `${buildSystemPrompt('אתה כותב מכתבים רשמיים בעברית לטובת הגשת תביעות ביטוח.')}

משימה: ${task}

פרטים:
- סוג מכתב: ${isDoctor ? 'מכתב לרופא' : 'מכתב תביעה לחברת הביטוח'}
- כותרת התביעה: ${claim_title}
- תיאור המקרה: ${claim_description}
${insurance_company ? `- חברת ביטוח: ${insurance_company}` : ''}
${policy_number ? `- מספר פוליסה: ${policy_number}` : ''}
${incident_date ? `- תאריך האירוע: ${incident_date}` : ''}
${user_name ? `- שם המגיש: ${user_name}` : ''}

כתוב מכתב מלא בעברית, מנוסח יפה, עם מקום לתאריך בראש המכתב (בפורמט DD/MM/YYYY), פנייה מתאימה, גוף המכתב, וחתימה בסוף. השתמש בשפה ברורה ופשוטה. סכומים בשקלים בלבד.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'automatic'
    });

    return Response.json({ content: typeof result === 'string' ? result : result?.reply || String(result) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}