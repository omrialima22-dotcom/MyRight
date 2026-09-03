import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    done: { type: "boolean", description: "האם נאסף מספיק מידע לתמונת מצב ראשונית של האירוע" },
    progress_label: { type: "string", description: "טקסט קצר ומעודד שמסמל התקדמות, ללא מספור. למשל: עוד קצת וסיימנו להבין מה קרה" },
    question: {
      type: "object",
      description: "השאלה הבאה. ריק כש-done=true",
      properties: {
        title: { type: "string", description: "כותרת קצרה לשאלה" },
        subtitle: { type: "string", description: "הסבר קצר אופציונלי, משפט אחד" },
        prompt: { type: "string", description: "נוסח השאלה עצמה, שפה חמה וטבעית" },
        answer_type: { type: "string", enum: ["quick", "text", "date"], description: "סוג התשובה" },
        options: { type: "array", items: { type: "string" }, description: "אפשרויות לתשובה מהירה (2-4). ריק כשאין" }
      }
    },
    timeline: {
      type: "array",
      description: "ציר זמן שנבנה מתוך השיחה",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "תיאור האירוע, למשל: אבחון" },
          date: { type: "string", description: "תאריך בפורמט DD/MM/YYYY, או ריק אם לא ידוע" }
        }
      }
    },
    summary: { type: "string", description: "כש-done=true, סיכום קצר ואנושי של תמונת המצב שנבנתה" }
  },
  required: ["done", "progress_label"]
};

const ROLE_INSTRUCTIONS = [
  "אתה מנהל כעת שאלון קליטה ראשוני מול המשתמש.",
  "מטרת השאלון: להבין מה קרה למשתמש ברמה העובדתית-אנושית — מה השתנה במצב הבריאותי, מתי, למשך כמה זמן, ואיך זה השפיע עליו.",
  "אתה לא מנסה לתבוע עדיין ביטוח ולא מזכיר מונחים ביטוחיים בשלב זה."
].join("\n");

const DECISION_INSTRUCTIONS = [
  "על בסיס התיאור הראשוני והתשובות שנאספו, החלט מה השאלה הבאה (או האם סיימת).",
  "",
  "כללים קריטיים:",
  "- שאל שאלה אחת בלבד בכל פעם. אל תציג רשימה של שאלות.",
  "- לעולם אל תניח עובדה רפואית או תפקודית בשם המשתמש. אם המשתמש כתב 'הייתי חלש', אל תסיק שהיה סיעודי. במקום זאת שאל על התפקוד בעדינות, למשל: 'אני רוצה להבין קצת יותר איך התקופה הזאת השפיעה על התפקוד היומיומי שלך.'",
  "- רק המשתמש מאשר מה קרה בפועל.",
  "- העדף תשובות מהירות (answer_type=quick) עם 2-4 אפשרויות קצרות. השתמש לרוב באפשרויות כמו: כן / לא / לא בטוח / לא זוכר.",
  "- בקש טקסט חופשי (text) או תאריך (date) רק כשבאמת צריך.",
  "- אל תשאל שאלות ביטוחיות (ADL, אובדן כושר עבודה, מצב סיעודי, תקופת המתנה וכו'). שאל רק על המציאות של המשתמש.",
  "- בנה ציר זמן מתוך התשובות (אבחון, תחילת טיפולים, סיום טיפולים, תקופת החלמה וכו'). אם חסר תאריך מרכזי, שאל עליו בצורה טבעית במהלך השיחה.",
  "- סה״כ כ-4 עד 6 שאלות. כשיש תמונת מצב ברורה (מה קרה, מתי בערך, משך התקופה, והשפעה תפקודית כפי שהמשתמש מתאר), הגדר done=true וכתוב סיכום קצר ואנושי ב-summary.",
  "- ב-progress_label כתוב משפט קצר ומעודד ללא מספור (אסור 'שאלה 3 מתוך 10'). למשל: 'מצטברת לנו תמונה', 'עוד קצת וסיימנו להבין מה קרה'.",
  "- כל הטקסטים בעברית בלבד."
].join("\n");

function safeParse(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return { reply: value }; }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { story = "", answers = [] } = body;
    if (!story || typeof story !== 'string' || story.trim().length < 3) {
      return Response.json({ error: 'חובה לשלוח תיאור ראשוני' }, { status: 400 });
    }

    if (Array.isArray(answers) && answers.length >= 8) {
      return Response.json({
        done: true,
        progress_label: 'סיימנו לאסוף את המידע הראשוני',
        summary: 'תיארת את האירוע ואת התקופה שאחריו — נמשיך משם'
      });
    }

    const systemPrompt = buildSystemPrompt(ROLE_INSTRUCTIONS);

    const qaBlock = (answers || [])
      .map((a, i) => `שאלה ${i + 1}: ${a.question}\nתשובה: ${a.answer}`)
      .join("\n\n");

    const prompt = [
      systemPrompt,
      "",
      "תיאור ראשוני של המשתמש:",
      story,
      "",
      qaBlock ? ("--- שאלות ותשובות עד כה ---\n" + qaBlock) : "(זוהי השאלה הראשונה)",
      "",
      DECISION_INSTRUCTIONS
    ].join("\n");

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: RESPONSE_SCHEMA,
      model: 'automatic'
    });

    const data = typeof result === 'string' ? safeParse(result) : result;
    return Response.json({ ...data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}