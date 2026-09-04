import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      type, claim_title, claim_description, insurance_company, policy_number, incident_date, user_name,
      coverage_name, coverage_conditions, source_clause, source_page, policy_requirements,
      user_answers, eligibility_summary
    } = body;
    if (!type || !claim_title || !claim_description) {
      return Response.json({ error: 'חסרים פרטים ליצירת המכתב' }, { status: 400 });
    }

    const isDoctor = type === 'doctor';

    const coverageBlock = coverage_name
      ? [
          "הכיסוי הרלוונטי:",
          `- שם הכיסוי: ${coverage_name}`,
          coverage_conditions ? `- תנאי הכיסוי: ${coverage_conditions}` : '',
          source_clause ? `- סעיף מקור: ${source_clause}` : '',
          source_page ? `- עמוד: ${source_page}` : '',
          policy_requirements ? `- דרישות הפוליסה (פשוט): ${policy_requirements}` : '',
          eligibility_summary ? `- סיכום הזכאות האפשרית: ${eligibility_summary}` : ''
        ].filter(Boolean).join("\n")
      : "";

    const answersBlock = (user_answers && user_answers.length)
      ? "--- תשובות המשתמש בבדיקת הזכאות ---\n" + user_answers.map(a => `ש: ${a.question}\nת: ${a.answer}`).join("\n")
      : "";

    const task = isDoctor
      ? "מכתב לרופא — בקשה מהרופא לאשר עובדות רפואיות ותפקודיות שרלוונטיות לכיסוי, על סמך התיק הרפואי והיכרותו המקצועית. אל תבקש מהרופא 'לאשר שהמטופל היה סיעודי' — במקום זאת בקש ממנו לאשר עובדות ניתנות לבדיקה (תקופה, מצב רפואי, רמת תפקוד, צורך בעזרת אדם אחר בפעולות יומיומיות, וכו')."
      : "מכתב תביעה רשמי לחברת הביטוח — מציג את פרטי המקרה, מפנה לסעיף הרלוונטי בפוליסה, מפרט את הבקשה לכיסוי/תשלום, ומצרף רשימת מסמכים. טון ענייני ומקצועי.";

    const prompt = `${buildSystemPrompt("אתה כותב מכתבים רשמיים בעברית לטובת הגשת תביעות ביטוח, מבוססי פוליסה.")}

משימה: ${task}

פרטים:
- סוג מכתב: ${isDoctor ? 'מכתב לרופא' : 'מכתב תביעה לחברת הביטוח'}
- כותרת התביעה: ${claim_title}
- תיאור המקרה: ${claim_description}
${insurance_company ? `- חברת ביטוח: ${insurance_company}` : ''}
${policy_number ? `- מספר פוליסה: ${policy_number}` : ''}
${incident_date ? `- תאריך האירוע: ${incident_date}` : ''}
${user_name ? `- שם המגיש: ${user_name}` : ''}

${coverageBlock}

${answersBlock}

כללים:
- אל תמציא מידע שלא אושר על ידי המשתמש או שלא כתוב בפוליסה.
- במכתב לרופא: בקש אישור של עובדות בלבד, לא מסקנות משפטיות-ביטוחיות.
- במכתב לחברת הביטוח: הפנה מפורשות לסעיף הרלוונטי, וצרף רשימת מסמכים בסוף.
- כתוב מכתב מלא בעברית, עם מקום לתאריך בראש (DD/MM/YYYY), פנייה, גוף, וחתימה. סכומים בשקלים בלבד.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude-sonnet-5'
    });

    return Response.json({ content: typeof result === 'string' ? result : result?.reply || String(result) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}