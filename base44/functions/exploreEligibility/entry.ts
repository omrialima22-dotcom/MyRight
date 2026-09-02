import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "כיסויים שעשויים להיות רלוונטיים לאירוע המתואר",
      items: {
        type: "object",
        properties: {
          coverage_index: { type: "number", description: "אינדקס הכיסוי במערך הפוליסה" },
          coverage_name: { type: "string" },
          relevant: { type: "boolean", description: "האם עשוי להיות רלוונטי לאירוע" },
          relevance_reason: { type: "string", description: "למה עשוי להיות רלוונטי — מבוסס על הכיסוי והאירוע. לעולם לא קובע זכאות." },
          policy_requirements: { type: "string", description: "מה הפוליסה דורשת, בעברית פשוטה, מבוסס על תנאי הכיסוי" },
          questions: {
            type: "array",
            description: "שאלות עובדתיות למשתמש, הנגזרות מתנאי הכיסוי, כדי לבדוק רלוונטיות אפשרית",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                answer_type: { type: "string", enum: ["quick", "text", "date"] },
                options: { type: "array", items: { type: "string" } }
              },
              required: ["prompt", "answer_type"]
            }
          }
        },
        required: ["coverage_index", "coverage_name", "relevant"]
      }
    }
  },
  required: ["items"]
};

const RULES = [
  "אתה בודק רלוונטיות אפשרית של כיסויים בפוליסה מול אירוע בריאותי שהמשתמש תיאר.",
  "מטרה: לזהות אילו כיסויים עשויים להיות רלוונטיים, ולהכין שאלות עובדתיות שיעזרו לבדוק זאת.",
  "כללים קריטיים:",
  "- לעולם אל תקבע זכאות. 'רלוונטי' = יש קשר אפשרי, לא שהמשתמש זכאי. אסור לכתוב 'מגיע לך', 'אתה זכאי', 'מגיע לך כסף'.",
  "- relevant=true רק אם יש קשר ענייני ברור בין תנאי הכיסוי לאירוע. אחרת relevant=false.",
  "- relevance_reason חייב להתבסס על טקסט הכיסוי ועל תיאור האירוע. אל תמציא.",
  "- policy_requirements: תרגם את תנאי הכיסוי (תקופת המתנה, תנאי זכאות, הגבלות) לעברית פשוטה. מבוסס על מה שכתוב בפוליסה בלבד.",
  "- questions: שאלות עובדתיות על מצב המשתמש בתקופה הרלוונטית, הנגזרות מתנאי הכיסוי.",
  "- השאלות חייבות להיות ניתנות לבדיקה עובדתית על ידי המשתמש. אל תסיק מסקנות בעצמך.",
  "- העדף answer_type=quick עם 2-4 אפשרויות (כן / לא / לא בטוח / לא זוכר).",
  "- אל תמציא כיסויים שלא קיימים בפוליסה.",
  "- כל הטקסטים בעברית בלבד."
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
    const { policy_id, policy_ids, health_event_id } = body;
    let ids = [];
    if (Array.isArray(policy_ids) && policy_ids.length) ids = policy_ids;
    else if (policy_id) ids = [policy_id];
    if (ids.length === 0) return Response.json({ error: 'חסר מזהה פוליסה' }, { status: 400 });

    const policies = [];
    for (const pid of ids) {
      try { const p = await base44.entities.Policy.get(pid); if (p) policies.push(p); } catch {}
    }
    if (policies.length === 0) return Response.json({ error: 'פוליסה לא נמצאה' }, { status: 404 });

    let event = null;
    if (health_event_id) { try { event = await base44.entities.HealthEvent.get(health_event_id); } catch {} }
    if (!event) { try { const recent = await base44.entities.HealthEvent.list('-created_date', 1); event = recent && recent[0] ? recent[0] : null; } catch {} }
    if (!event || !event.story) return Response.json({ error: 'no_health_event', items: [] });

    const eventBlock = [
      "תיאור האירוע מהמשתמש:",
      event.story,
      event.summary ? ("\nסיכום תמונת המצב: " + event.summary) : "",
      (event.answers && event.answers.length)
        ? ("--- שאלות ותשובות מהשאלון ---\n" + event.answers.map(a => `ש: ${a.question}\nת: ${a.answer}`).join("\n"))
        : ""
    ].join("\n");

    const allItems = [];

    for (const policy of policies) {
      const coverages = Array.isArray(policy.coverages) ? policy.coverages : [];
      if (coverages.length === 0) continue;

      const insurerName = policy.insurance_company || (policy.policy_metadata && policy.policy_metadata.insurerName) || '';
      const insuredPeople = Array.isArray(policy.insured_people) ? policy.insured_people : [];
      const selectedRole = policy.confirmed_insured_role || (insuredPeople[0] && insuredPeople[0].role) || null;
      const coverageList = [];
      coverages.forEach((c, i) => {
        const person = selectedRole && Array.isArray(c.persons)
          ? (c.persons.find((p) => p.role === selectedRole) || null)
          : null;
        // Skip coverages the selected insured person does not have.
        if (person && person.isCovered === false) return;
        coverageList.push({
          index: i,
          name: c.name || '',
          benefit: (person && person.sumInsured) ? person.sumInsured : (c.benefit || ''),
          productMaximum: c.productMaximum || '',
          conditions: c.conditions || '',
          exclusions: c.exclusions || '',
          waitingPeriod: c.waitingPeriod || '',
          eligibility: c.eligibility || '',
          sourceClause: (person && person.sourceClause) || c.sourceClause || '',
          sourcePage: (person && person.sourcePage != null) ? person.sourcePage : (c.sourcePage ?? null),
          sourceText: (person && person.sourceText) || c.sourceText || '',
          personRole: selectedRole || ''
        });
      });
      if (coverageList.length === 0) continue;

      const prompt = [
        buildSystemPrompt("אתה עוזר ביטוחי שבודק רלוונטיות אפשרית של כיסויים בפוליסה מול אירוע בריאותי."),
        "",
        eventBlock,
        "",
        `--- כיסויים שנמצאו בפוליסה (${insurerName || 'חברת ביטוח'}) ---`,
        JSON.stringify(coverageList, null, 2),
        "",
        "לכל כיסוי, החלט אם הוא עשוי להיות רלוונטי לאירוע (relevant). אם כן — מלא relevance_reason, policy_requirements ו-questions.",
        RULES
      ].join("\n");

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: SCHEMA,
        model: 'automatic'
      });

      const data = safeObj(result, { items: [] });
      const its = Array.isArray(data?.items) ? data.items : [];

      for (const it of its) {
        if (it.relevant === false) continue;
        const idx = typeof it.coverage_index === 'number' ? it.coverage_index : -1;
        const cl = coverageList.find((x) => x.index === idx);
        if (!cl) continue;
        allItems.push({
          key: `${policy.id}::${idx}`,
          policy_id: policy.id,
          insurer: insurerName,
          coverage_index: idx,
          coverage_name: it.coverage_name || cl.name || '',
          relevance_reason: it.relevance_reason || '',
          policy_requirements: it.policy_requirements || '',
          questions: Array.isArray(it.questions) ? it.questions : [],
          source_clause: cl.sourceClause,
          source_page: cl.sourcePage,
          source_text: cl.sourceText,
          benefit: cl.benefit,
          product_maximum: cl.productMaximum || '',
          person_role: cl.personRole,
          conditions: cl.conditions || ''
        });
      }
    }

    return Response.json({ items: allItems });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}