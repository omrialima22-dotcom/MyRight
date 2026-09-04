import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "כיסויים קנוניים ייחודיים שעשויים להיות רלוונטיים. פריט אחד בלבד לכל כיסוי מבוטח בפועל.",
      items: {
        type: "object",
        properties: {
          coverage_name: { type: "string", description: "שם הכיסוי הקנוני" },
          relevance: {
            type: "string",
            enum: ["direct", "indirect", "unlikely"],
            description: "direct = נובע ישירות מהאירוע שהמשתמש תיאר. indirect = עשוי להיות רלוונטי בעקבות השלכה אפשרית של אירוע כזה, גם אם המשתמש לא הזכיר אותה. unlikely = אין קשר סביר."
          },
          pathway: { type: "string", description: "שם ההשלכה (pathway) שבגללה הכיסוי נבדק. ריק כשה-relevance הוא direct." },
          relevance_reason: { type: "string" },
          policy_requirements: { type: "string" },
          conditions: { type: "string", description: "תנאי הזכאות של הכיסוי — מועתק/ממוזג מהקלט" },
          benefit: { type: "string", description: "הסכום האישי של המבוטח — העתק מהקלט, לא תקרת מוצר" },
          product_maximum: { type: "string" },
          person_role: { type: "string", description: "המבוטח שנבחר — העתק מהקלט" },
          source_clause: { type: "string", description: "סעיף מקור עיקרי — העתק מהקלט" },
          source_page: { type: "number", description: "עמוד מקור עיקרי — העתק מהקלט" },
          source_text: { type: "string", description: "נוסח מקורי עיקרי — העתק מהקלט" },
          clauses: {
            type: "array",
            description: "כל הסעיפים/עמודים שנוגעים לכיסוי זה (לוח תשלומים, הגדרה, תקופת המתנה, חריגים) — מצורפים לפריט אחד",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["schedule", "definition", "waiting_period", "exclusion", "condition", "other"] },
                page: { type: "number" },
                clause: { type: "string" },
                text: { type: "string" }
              }
            }
          },
          questions: {
            type: "array",
            description: "שאלות עובדתיות למשתמש, הנגזרות מתנאי הכיסוי",
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
        required: ["coverage_name", "relevance"]
      }
    }
  },
  required: ["items"]
};

const RULES = [
  "אתה בודק רלוונטיות אפשרית של כיסויים בפוליסה מול אירוע בריאותי שהמשתמש תיאר.",
  "",
  "כללי דה-דופליקציה (קריטי):",
  "- מזג כיסויים שמתייחסים לאותו כיסוי מבוטח בפועל לפריט אחד. אזכורים חוזרים של אותו כיסוי בעמודים/סעיפים שונים (לוח תשלומים, הגדרה, תקופת המתנה, חריגים) אינם יוצרים כיסויים נפרדים — צרף את כולם תחת clauses של אותו פריט.",
  "- אל תפצל כיסוי אחד למספר פריטים. סעיף מקור אינו זכות נפרדת.",
  "- שמור כיסויים שונים באמת כפריטים נפרדים (למשל שני כיסויי סרטן שהפוליסה מתייחסת אליהם כשני מוצרים נפרדים).",
  "",
  "כללי רלוונטיות (קריטי — כאן נמצא הערך של המערכת):",
  "- לעולם אל תקבע זכאות. 'רלוונטי' = שווה לבדוק, לא שהמשתמש זכאי. אסור 'מגיע לך', 'אתה זכאי', 'מגיע לך כסף'.",
  "- relevance='direct': הכיסוי נוגע ישירות למה שהמשתמש תיאר (למשל אבחנה שמופיעה בכיסוי מחלות קשות).",
  "- relevance='indirect': הכיסוי נוגע לאחת ההשלכות האפשריות שקיבלת ברשימת ההשלכות — גם אם המשתמש לא הזכיר אותה בכלל. זו הקטגוריה החשובה ביותר: המשתמש לא יודע לבדוק לבד שאירוע כזה עלול להוביל לצורך בעזרה יומיומית, לאובדן כושר עבודה, לניתוח, לתרופה מחוץ לסל וכו'. אם קיים בפוליסה כיסוי שנוגע להשלכה כזו — סמן indirect וציין ב-pathway את שם ההשלכה.",
  "- relevance='unlikely' רק כשאין שום קשר סביר לא לאירוע ולא לאף אחת מההשלכות. אל תשתמש בזה רק כי המשתמש לא הזכיר משהו — היעדר אזכור אינו שלילה.",
  "- אל תניח שההשלכה קרתה. עבור indirect, ה-questions חייבות לכלול קודם כל שאלה עובדתית שמבררת אם ההשלכה אכן התרחשה (למשל 'האם בתקופה הזאת היית זקוק לעזרה של אדם אחר בפעולות יומיומיות כמו רחצה או הלבשה?').",
  "- relevance_reason: הסבר בעברית פשוטה למה שווה לבדוק. ב-indirect פתח בקישור: 'בעקבות מה שתיארת, ייתכן ש…'.",
  "- questions: שאלות עובדתיות ניתנות לבדיקה. העדף answer_type=quick עם 2-4 אפשרויות.",
  "",
  "כללי סכומים (קריטי):",
  "- benefit = הסכום האישי של המבוטח שהתקבל בקלט בלבד. אל תחליף בתקרת מוצר.",
  "- product_maximum נשמר בנפרד ואינו הסכום האישי.",
  "- העתק source_page / source_clause / source_text / clauses / person_role / benefit / product_maximum / conditions אך ורק מתוך נתוני הכיסוי שהתקבלו. אל תמציא מקורות או סכומים.",
  "- כל הטקסטים בעברית בלבד."
].join("\n");

function safeObj(result, fallback) {
  if (result && typeof result === 'object') return result;
  if (typeof result === 'string') { try { return JSON.parse(result); } catch { return fallback; } }
  return fallback;
}

// Stage 0 — consequence expansion. Generic for ANY event the user describes
// (illness, accident, injury, surgery): derives the consequence pathways that
// events of this kind commonly lead to, so coverages can be checked against
// them too — not only against the words the user happened to write.
const PATHWAYS_SCHEMA = {
  type: "object",
  properties: {
    event_kind: { type: "string", description: "סוג האירוע בקצרה: מחלה / תאונה / פגיעה / ניתוח / אחר" },
    main_finding: { type: "string", description: "האבחנה או הפגיעה המרכזית כפי שהמשתמש תיאר אותה" },
    pathways: {
      type: "array",
      description: "ההשלכות האפשריות של אירוע מהסוג הזה — כולל כאלה שהמשתמש לא הזכיר.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "שם ההשלכה בעברית פשוטה, למשל 'צורך בעזרה בפעולות יומיום', 'אובדן כושר עבודה', 'ניתוח', 'תרופה מחוץ לסל', 'שיקום', 'נכות תפקודית'" },
          why: { type: "string", description: "משפט קצר למה אירוע כזה עלול להוביל להשלכה הזאת" },
          likelihood: { type: "string", enum: ["typical", "possible"], description: "typical = נפוץ באירועים מסוג זה. possible = ייתכן." },
          user_reported: { type: "boolean", description: "true רק אם המשתמש עצמו תיאר את ההשלכה במפורש" }
        },
        required: ["name", "likelihood", "user_reported"]
      }
    }
  },
  required: ["pathways"]
};

const PATHWAYS_RULES = [
  "משימתך: להסיק מה אירוע כזה עלול לגרור, כדי שנדע מה לבדוק בפוליסה.",
  "",
  "כללים:",
  "- אל תגביל את עצמך למה שהמשתמש כתב. משתמשים מתארים את האבחנה או התאונה, ולא יודעים אילו השלכות פותחות זכויות ביטוחיות. בדיוק שם הערך שלנו.",
  "- הסק על בסיס ידע רפואי-תפקודי כללי מה אירוע מהסוג הזה עלול לגרור. עבוד כך לכל סוג אירוע: מחלה, תאונת דרכים, תאונת עבודה, פגיעה אורתופדית, אירוע לב/מוח, ניתוח, וכו'.",
  "- כסה תחומי השלכה רלוונטיים כמו: צורך בעזרה בפעולות יומיום ותלות תפקודית, אובדן או פגיעה בכושר עבודה, ניתוחים והתייעצויות, אשפוז, טיפולים אמבולטוריים, תרופות שאינן בסל, השתלות וטיפולים בחו״ל, שיקום והחלמה, אביזרים ועזרים, נכות זמנית או קבועה, פגיעה נפשית נלווית.",
  "- כלול רק השלכות שסבירות לאירוע שתואר. אל תמציא רשימה גנרית שאינה קשורה.",
  "- likelihood='typical' כשההשלכה נפוצה באירועים כאלה, 'possible' כשהיא אפשרית.",
  "- user_reported=true רק כשהמשתמש כתב זאת במפורש. לעולם אל תסיק שההשלכה קרתה בפועל — אנחנו רק מסמנים מה כדאי לבדוק.",
  "- הכל בעברית פשוטה."
].join("\n");

function normalizeName(s) {
  return String(s || '').replace(/[\s\u200f\u200e\-–—,.:"'()]/g, '').toLowerCase();
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

    // STAGE 0 — derive the consequence pathways once, shared by all policies.
    let pathways = [];
    try {
      const pw = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: [
          buildSystemPrompt("אתה מסיק מה אירוע רפואי או תאונה עלולים לגרור, לצורך בדיקת כיסויים בפוליסה."),
          "",
          eventBlock,
          "",
          PATHWAYS_RULES
        ].join("\n"),
        response_json_schema: PATHWAYS_SCHEMA,
        model: 'claude-sonnet-5'
      });
      const pwData = safeObj(pw, { pathways: [] });
      pathways = Array.isArray(pwData.pathways) ? pwData.pathways : [];
    } catch { /* discovery continues without expansion */ }

    const pathwaysBlock = pathways.length
      ? [
          "--- השלכות אפשריות של אירוע מסוג זה (הוסקו על ידי המערכת, לא נאמרו בהכרח על ידי המשתמש) ---",
          JSON.stringify(pathways, null, 2),
          "בדוק כל כיסוי בפוליסה גם מול ההשלכות האלה, לא רק מול מה שהמשתמש כתב במפורש."
        ].join("\n")
      : "";

    const allItems = [];
    const needsIdentity = [];

    for (const policy of policies) {
      const coverages = Array.isArray(policy.coverages) ? policy.coverages : [];
      if (coverages.length === 0) continue;

      const insurerName = policy.insurance_company || (policy.policy_metadata && policy.policy_metadata.insurerName) || '';
      const insuredPeople = Array.isArray(policy.insured_people) ? policy.insured_people : [];

      // HARD GATE (logic-level): a multi-person policy with no confirmed identity
      // must NOT produce user-specific eligibility results — only general structure
      // may exist until the user confirms who they are.
      if (insuredPeople.length > 1 && !policy.confirmed_insured_role) {
        needsIdentity.push(policy.id);
        continue;
      }

      const selectedRole = policy.confirmed_insured_role || (insuredPeople[0] && insuredPeople[0].role) || null;

      // Filter to the selected insured person only; skip coverages they do not have.
      const coverageList = [];
      coverages.forEach((c, i) => {
        const person = selectedRole && Array.isArray(c.persons)
          ? (c.persons.find((p) => p.role === selectedRole) || null)
          : null;
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
          clauses: Array.isArray(c.clauses) ? c.clauses : [],
          personRole: selectedRole || ''
        });
      });
      if (coverageList.length === 0) continue;

      const prompt = [
        buildSystemPrompt("אתה עוזר ביטוחי שממזג כיסויים כפולים ובודק רלוונטיות אפשרית מול אירוע בריאותי."),
        "",
        eventBlock,
        "",
        pathwaysBlock,
        "",
        `--- כיסויים שנמצאו בפוליסה עבור המבוטח "${selectedRole || 'מבוטח ראשי'}" (${insurerName || 'חברת ביטוח'}) ---`,
        JSON.stringify(coverageList, null, 2),
        "",
        "לכל כיסוי בפועל, החזר פריט קנוני אחד (ממוזג אם יש כפילויות). קבע relevance (direct / indirect / unlikely) ומלא pathway, relevance_reason, policy_requirements, conditions ו-questions.",
        RULES
      ].join("\n");

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: SCHEMA,
        model: 'claude-sonnet-5'
      });

      const data = safeObj(result, { items: [] });
      const its = Array.isArray(data?.items) ? data.items : [];

      // Safety dedup by normalized coverage name — merge clauses of true duplicates.
      const deduped = [];
      const seen = {};
      for (const it of its) {
        if (it.relevance === 'unlikely') continue;
        const norm = normalizeName(it.coverage_name);
        if (!norm) { deduped.push(it); continue; }
        if (seen[norm] != null) {
          const existing = deduped[seen[norm]];
          if (Array.isArray(it.clauses)) {
            existing.clauses = [...(existing.clauses || []), ...it.clauses];
          }
          continue;
        }
        seen[norm] = deduped.length;
        deduped.push(it);
      }

      let ci = 0;
      for (const it of deduped) {
        allItems.push({
          key: `${policy.id}::${ci++}`,
          policy_id: policy.id,
          insurer: insurerName,
          coverage_name: it.coverage_name || '',
          relevance: it.relevance === 'indirect' ? 'indirect' : 'direct',
          pathway: it.pathway || '',
          relevance_reason: it.relevance_reason || '',
          policy_requirements: it.policy_requirements || '',
          conditions: it.conditions || '',
          questions: Array.isArray(it.questions) ? it.questions : [],
          source_clause: it.source_clause || '',
          source_page: it.source_page ?? null,
          source_text: it.source_text || '',
          benefit: it.benefit || '',
          product_maximum: it.product_maximum || '',
          person_role: it.person_role || selectedRole || '',
          clauses: Array.isArray(it.clauses) ? it.clauses : []
        });
      }
    }

    return Response.json({ items: allItems, needs_identity: needsIdentity, pathways });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}