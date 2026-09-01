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
    const { insurance_company, policy_type, policy_number, coverage_amount, monthly_premium, notes } = body;
    if (!insurance_company || !policy_type) {
      return Response.json({ error: 'חסים פרטי פוליסה בסיסיים' }, { status: 400 });
    }

    const summary = [
      `חברת ביטוח: ${insurance_company}`,
      `סוג ביטוח: ${POLICY_TYPE_LABELS[policy_type] || policy_type}`,
      policy_number ? `מספר פוליסה: ${policy_number}` : '',
      coverage_amount ? `סכום כיסוי: ${Number(coverage_amount).toLocaleString('he-IL')} ₪` : '',
      monthly_premium ? `פרמיה חודשית: ${Number(monthly_premium).toLocaleString('he-IL')} ₪` : '',
      notes ? `הערות נוספות: ${notes}` : ''
    ].filter(Boolean).join('\n');

    const prompt = `${buildSystemPrompt('אתה מנתח פוליסת ביטוח ומסביר אותה למשתמש בעברית פשוטה.')}

להלן פרטי הפוליסה שהמשתמש הזין:
${summary}

אנא כתוב ניתוח בעברית פשוטה וברורה שכולל את הסעיפים הבאים, כשכל סעיף כותרת קצרה ומתחתיה הסבר:
1. מה מכסה הפוליסה הזו – במילים פשוטות.
2. מה לא מכוסה – חריגים נפוצים לסוג הביטוח הזה (ציין שזה כללי ושיש לבדוק בפוליסה עצמה).
3. דברים חשובים שכדאי לשים לב אליהם (למשל תקופת המתנה, השתתפות עצמית, תקופת התחייבות) – כל מונח עם הסבר קצר מתחתיו.
4. המלצות פרקטיות למשתמש – מה כדאי לעשות עכשיו.

סכומים בשקלים בלבד. תאריכים בפורמט DD/MM/YYYY. כתוב בעברית טבעית וחמה.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'automatic'
    });

    return Response.json({ analysis: typeof result === 'string' ? result : result?.reply || String(result) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}