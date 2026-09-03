import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

const SCHEMA = {
  type: "object",
  properties: {
    potential_match: { type: "boolean", description: "האם קיימת זכאות אפשרית שכדאי לבדוק" },
    explanation: { type: "string", description: "מה בתשובות המשתמש עשוי להתאים לתנאי הפוליסה. לעולם לא 'זכאי' אלא 'ייתכן שרלוונטי'." },
    missing_info: { type: "string", description: "מידע חסר שעדיין דרוש, או ריק" },
    benefit: { type: "string", description: "הסכום/הקצבה כפי שמופיעים בפוליסה, או ריק" }
  },
  required: ["potential_match", "explanation"]
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
    const { coverage, answers, event_summary } = body;
    if (!coverage) return Response.json({ error: 'חסר פרטי כיסוי' }, { status: 400 });

    const answersBlock = (answers && answers.length)
      ? answers.map(a => `ש: ${a.question}\nת: ${a.answer}`).join("\n")
      : "(אין תשובות עדיין)";

    const prompt = [
      buildSystemPrompt("אתה בודק התאמה אפשרית בין תשובות המשתמש לבין תנאי כיסוי בפוליסה."),
      "",
      "כיסוי:",
      JSON.stringify({
        name: coverage.name,
        benefit: coverage.benefit,
        conditions: coverage.conditions,
        exclusions: coverage.exclusions,
        waitingPeriod: coverage.waitingPeriod,
        eligibility: coverage.eligibility,
        sourceClause: coverage.sourceClause
      }, null, 2),
      "",
      "תמונת האירוע:",
      event_summary || "(לא סופק)",
      "",
      "תשובות המשתמש:",
      answersBlock,
      "",
      "כללים קריטיים:",
      "- לעולם אל תקבע זכאות וודאית. אסור לכתוב 'זכאי', 'מגיע לך', 'מגיע לך כסף'.",
      "- potential_match=true רק אם יש סיכוי סביר שהכיסוי רלוונטי. אחרת false.",
      "- explanation: מה בתשובות עשוי להתאים לתנאים, ומה עדיין לא ברור. שפה זהירה: 'ייתכן ש...', 'כדאי לבדוק'.",
      "- missing_info: אם חסר מידע מכריע, ציין מה. אחרת ריק.",
      "- כל הטקסטים בעברית."
    ].join("\n");

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: SCHEMA,
      model: 'automatic'
    });

    const data = safeObj(result, { potential_match: false, explanation: '' });
    return Response.json({
      potential_match: !!data?.potential_match,
      explanation: data?.explanation || '',
      missing_info: data?.missing_info || '',
      benefit: data?.benefit || coverage?.benefit || ''
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}