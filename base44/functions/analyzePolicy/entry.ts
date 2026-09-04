import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// STAGE 1 schema — light and fast: read the actual PDF text page-by-page
// plus key header fields. (A heavier nested schema timed out.)
const READ_SCHEMA = {
  type: "object",
  properties: {
    isReadable: {
      type: "boolean",
      description: "האם הצלחת לקרוא טקסט משמעותי מהמסמך. false אם הקובץ סרוק/תמונה ללא שכבת טקסט."
    },
    issues: { type: "string", description: "בעיות בחילוץ, ריק אם אין" },
    insurerName: { type: "string", description: "שם חברת הביטוח המופיע במסמך" },
    policyName: { type: "string", description: "שם הפוליסה / מוצר הביטוח" },
    policyNumber: { type: "string", description: "מספר הפוליסה המופיע במסמך" },
    insurancePeriod: { type: "string", description: "תקופת הביטוח" },
    policyType: { type: "string", description: "סוג הביטוח לפי מה שכתוב" },
    pageTexts: {
      type: "array",
      description: "הטקסט שחולץ מכל עמוד במסמך, עם מספר העמוד.",
      items: {
        type: "object",
        properties: {
          pageNumber: { type: "number", description: "מספר העמוד בקובץ המקורי" },
          text: { type: "string", description: "הטקסט שחולץ מהעמוד" }
        }
      }
    }
  }
};

// STAGE 2 schema — structured coverages derived ONLY from the extracted text.
// Coverages are extracted PER INSURED PERSON (matrix-aware), and the product
// maximum is kept separate from each person's actual insured amount.
const COVERAGES_SCHEMA = {
  type: "object",
  properties: {
    insuredPeople: {
      type: "array",
      description: "כל המבוטחים בפוליסה לפי התוויות שמופיעות במסמך (מבוטח ראשי, מבוטח שני, ילד 1 וכו'). אם מדובר באדם אחד — מערך בן פריט אחד.",
      items: {
        type: "object",
        properties: {
          role: { type: "string", description: "התווית/התפקיד כפי שמופיע במסמך, למשל 'מבוטח ראשי', 'ילד 1'" },
          fullName: { type: "string", description: "שם מלא אם מופיע בבירור" },
          identificationNumber: { type: "string", description: "מספר זהות אם מופיע — השאר ריק אם לא" },
          sourcePage: { type: "number" },
          sourceText: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["role"]
      }
    },
    coverages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "שם הכיסוי" },
          benefit: { type: "string", description: "סכום/קצבת הפיצוי הכללי אם מופיע" },
          productMaximum: { type: "string", description: "סכום מקסימלי של המוצר / תקרה כללית — לא הסכום האישי של מבוטח. ריק אם לא מופיע." },
          conditions: { type: "string", description: "תנאי זכאות" },
          exclusions: { type: "string", description: "חריגים" },
          waitingPeriod: { type: "string", description: "תקופת המתנה/אכשרה" },
          sourcePage: { type: "number" },
          sourceClause: { type: "string" },
          sourceText: { type: "string", description: "הנוסח המקורי המדויק מהפוליסה" },
          plainExplanation: { type: "string", description: "הסבר בעברית פשוטה" },
          persons: {
            type: "array",
            description: "הנתונים של כל מבוטח עבור כיסוי זה. חובה לשמור את הקשר שורה+עמודה+ערך. אם הכיסוי חל על כולם — צור פריט לכל מבוטח.",
            items: {
              type: "object",
              properties: {
                role: { type: "string", description: "תואם ל-role ב-insuredPeople" },
                isCovered: { type: "boolean" },
                sumInsured: { type: "string", description: "הסכום שחל על מבוטח זה בכיסוי זה" },
                extensions: { type: "string" },
                sourcePage: { type: "number" },
                sourceClause: { type: "string" },
                sourceText: { type: "string", description: "הנוסח המקורי המתייחס לעמודה/לסכום הזה" }
              },
              required: ["role", "isCovered"]
            }
          }
        },
        required: ["name", "persons"]
      }
    },
    overallSummary: { type: "string", description: "סיכום כללי בעברית פשוטה" }
  }
};

// Model used for Stage 2 coverage extraction. Kept as a named constant so the
// value that ran is visible in the batch-failure log below.
// NOTE: 'gemini_3_pro' (used previously) is no longer listed in the Base44 SDK
// model union; 'gemini_3_1_pro' is the currently documented Gemini Pro id.
const COVERAGES_MODEL = 'gemini_3_1_pro';

const UNREADABLE_MESSAGE =
  "לא הצלחנו לקרוא את תוכן הפוליסה בצורה אמינה. ייתכן שמדובר בקובץ סרוק ללא שכבת טקסט. כדי ש-MyRight תוכל לנתח את הפוליסה, מומלץ להעלות גרסה חיפושית (PDF עם שכבת טקסט) של המסמך. אנחנו לא רוצים לנחש עבורך.";

export default async function(req) {
  let base44;
  let policyId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { policy_id } = body;
    policyId = policy_id;
    if (!policy_id) return Response.json({ error: 'חסר מזהה פוליסה' }, { status: 400 });

    const policy = await base44.entities.Policy.get(policy_id);
    if (!policy) return Response.json({ error: 'פוליסה לא נמצאה' }, { status: 404 });
    if (!policy.file_url) return Response.json({ error: 'לא צורף קובץ פוליסה – לא ניתן לנתח' }, { status: 400 });

    await base44.entities.Policy.update(policy_id, { extraction_status: 'processing', extraction_issues: '' });

    // STAGE 1: read the actual PDF.
    const read = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: policy.file_url,
      json_schema: READ_SCHEMA
    });

    if (!read || read.status !== 'success' || !read.output) {
      await base44.entities.Policy.update(policy_id, {
        extraction_status: 'unreadable',
        extraction_issues: (read && read.details) || 'לא הצלחנו לקרוא את תוכן הקובץ'
      });
      return Response.json({ status: 'unreadable', message: UNREADABLE_MESSAGE });
    }

    const data = read.output || {};
    const pages = Array.isArray(data.pageTexts) ? data.pageTexts : [];
    const hasText = pages.some((p) => p.text && String(p.text).trim().length > 0);
    const markedUnreadable = data.isReadable === false;

    if (markedUnreadable || (!hasText && !data.insurerName)) {
      await base44.entities.Policy.update(policy_id, {
        extraction_status: 'unreadable',
        extraction_issues: data.issues || 'תוכן המסמך לא היה קריא בצורה אמינה'
      });
      return Response.json({ status: 'unreadable', message: UNREADABLE_MESSAGE });
    }

    const documentSections = pages
      .filter((p) => p.text && String(p.text).trim())
      .map((p) => ({
        pageStart: p.pageNumber != null ? Number(p.pageNumber) : null,
        pageEnd: p.pageNumber != null ? Number(p.pageNumber) : null,
        sectionTitle: '',
        clauseNumber: '',
        text: String(p.text).trim()
      }));

    const policyMetadata = {
      insurerName: data.insurerName || '',
      policyName: data.policyName || '',
      policyNumber: data.policyNumber || '',
      insurancePeriod: data.insurancePeriod || '',
      policyType: data.policyType || '',
      definitions: []
    };

    const update = {
      document_sections: documentSections,
      policy_metadata: policyMetadata,
      extraction_issues: data.issues || ''
    };
    const placeholder = !policy.insurance_company || policy.insurance_company.indexOf('טרם זוהה') >= 0;
    if (policyMetadata.insurerName && (placeholder || !policy.insurance_company)) {
      update.insurance_company = policyMetadata.insurerName;
    }
    if (policyMetadata.policyNumber && !policy.policy_number) {
      update.policy_number = policyMetadata.policyNumber;
    }

    // STAGE 1 SAVE — persist the read document + identified metadata now, so the
    // live UI can surface real discoveries (insurer, type, period) before coverages.
    await base44.entities.Policy.update(policy_id, update);

    // STAGE 2: identify coverages from the extracted text (grounded, no invention).
    // Long policies are split into batches so no chunk exceeds the LLM's reliable
    // context window; batches run sequentially and are merged afterward.
    const batches = buildContextBatches(documentSections);
    let coverages = [];
    let insuredPeople = [];
    let overallSummary = '';

    // Batches are independent, so they run in PARALLEL — sequential runs made a
    // multi-page policy take minutes. Order is preserved by Promise.allSettled.
    const activeBatches = batches.filter((b) => buildContextText(b).trim());
    const settled = await Promise.allSettled(
      activeBatches.map((batch) =>
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: buildCoveragesPrompt(buildContextText(batch)),
          response_json_schema: COVERAGES_SCHEMA,
          model: COVERAGES_MODEL
        })
      )
    );

    const batchResults = [];
    settled.forEach((s, i) => {
      if (s.status !== 'fulfilled') {
        // A failed batch must not kill the rest — but it must be visible, since a
        // silent failure looks identical to "no coverages on those pages".
        console.error(
          `Stage 2 batch failed (pages ${activeBatches[i].map((x) => x.pageStart).join(',')}, model ${COVERAGES_MODEL}):`,
          s.reason?.message || s.reason
        );
        return;
      }
      const result = (s.value && typeof s.value === 'object') ? s.value : null;
      if (!result) return;
      batchResults.push({
        coverages: Array.isArray(result.coverages) ? result.coverages.map(normalizeCoverage) : [],
        insuredPeople: Array.isArray(result.insuredPeople) ? result.insuredPeople.map(normalizeInsuredPerson) : [],
        overallSummary: result.overallSummary || ''
      });
    });

    if (batchResults.length === 1) {
      coverages = batchResults[0].coverages;
      insuredPeople = batchResults[0].insuredPeople;
      overallSummary = batchResults[0].overallSummary;
    } else if (batchResults.length > 1) {
      insuredPeople = mergeInsuredPeople(batchResults.map((r) => r.insuredPeople));
      coverages = mergeCoverages(batchResults.map((r) => r.coverages));
      // overallSummary intentionally left empty — buildFallbackSummary runs on the merged coverages below.
    }

    const analysis = overallSummary || buildFallbackSummary(policyMetadata, coverages, documentSections);

    // STAGE 2 SAVE — persist insured people, per-person coverages + summary; mark complete.
    await base44.entities.Policy.update(policy_id, {
      insured_people: insuredPeople,
      coverages,
      analysis,
      extraction_status: 'success'
    });

    return Response.json({
      status: 'success',
      policy_metadata: policyMetadata,
      coverages,
      document_sections: documentSections,
      analysis
    });
  } catch (error) {
    if (base44 && policyId) {
      try {
        await base44.entities.Policy.update(policyId, {
          extraction_status: 'failed',
          extraction_issues: error?.message || 'שגיאה לא צפויה במהלך הניתוח'
        });
      } catch { /* best-effort */ }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function buildContextText(sections) {
  return sections.map((s) => {
    const page = s.pageStart != null ? `=== עמוד ${s.pageStart} ===\n` : '';
    return page + s.text;
  }).join('\n\n');
}

const CONTEXT_BATCH_CHAR_LIMIT = 12000;

// Group sections in order into batches, opening a new batch once the
// accumulated text length would exceed the limit. A single section longer
// than the limit gets its own batch rather than being cut mid-section.
function buildContextBatches(sections) {
  const batches = [];
  let current = [];
  let currentLen = 0;
  for (const s of sections) {
    const len = (s.text || '').length;
    if (len > CONTEXT_BATCH_CHAR_LIMIT) {
      if (current.length > 0) { batches.push(current); current = []; currentLen = 0; }
      batches.push([s]);
      continue;
    }
    if (current.length > 0 && currentLen + len > CONTEXT_BATCH_CHAR_LIMIT) {
      batches.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(s);
    currentLen += len;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function normalizeName(s) {
  return String(s || '').replace(/[\s\u200f\u200e\-–—,.:"'()]/g, '').toLowerCase();
}

// Merge insuredPeople across batches: same role → keep the highest-confidence
// occurrence, first-seen wins on ties.
function mergeInsuredPeople(peopleLists) {
  const confidenceRank = { high: 3, medium: 2, low: 1 };
  const byRole = new Map();
  const order = [];
  for (const list of peopleLists) {
    for (const p of list) {
      const role = p.role || '';
      if (!byRole.has(role)) {
        byRole.set(role, p);
        order.push(role);
      } else {
        const existing = byRole.get(role);
        if ((confidenceRank[p.confidence] || 0) > (confidenceRank[existing.confidence] || 0)) {
          byRole.set(role, p);
        }
      }
    }
  }
  return order.map((role) => byRole.get(role));
}

// Merge coverages across batches: same normalized name → merge persons/clauses
// into the first occurrence instead of creating a duplicate coverage entry.
function mergeCoverages(coverageLists) {
  const merged = [];
  const seen = {};
  for (const list of coverageLists) {
    for (const c of list) {
      const norm = normalizeName(c.name);
      if (!norm) { merged.push(c); continue; }
      if (seen[norm] != null) {
        const existing = merged[seen[norm]];
        if (Array.isArray(c.persons)) existing.persons = [...(existing.persons || []), ...c.persons];
        if (Array.isArray(c.clauses)) existing.clauses = [...(existing.clauses || []), ...c.clauses];
        continue;
      }
      seen[norm] = merged.length;
      merged.push(c);
    }
  }
  return merged;
}

function buildCoveragesPrompt(contextText) {
  return `אתה מנתח פוליסות ביטוח ישראליות. להלן הטקסט שחולץ מתוך פוליסה, מאורגן לפי עמודים. הטקסט הזה הוא המקור היחיד שעליו אתה מסתמך.

שלב א' — זיהוי מבוטחים (insuredPeople):
- זהה את כל המבוטחים בפוליסה לפי התוויות שמופיעות במסמך (מבוטח ראשי, מבוטח שני, ילד 1, ילד 2 וכו').
- אם מופיע רק אדם אחד — החזר מערך בן פריט אחד.
- אל תנחש מי מהם המשתמש. רק תעד את מה שכתוב. אל תנחש שמות או מספרי זהות שלא מופיעים.

שלב ב' — כיסויים לפי מבוטח (coverages):
- זהה אך ורק כיסויים שמופיעים בפועל בטקסט. אל תמציא כיסויים שלא מוזכרים.
- פוליסות רבות מציגות טבלת מטריצה: שורות = כיסויים, עמודות = מבוטחים. חובה לשמור את הקשר שורה + עמודה + ערך. אל תשטח טבלה לערך גלובלי אחד שלא שייך לעמודה מסוימת.
- לכל כיסוי, מלא persons: פריט לכל מבוטח עם הסכום/הבחירה שחלים עליו באותה עמודה. אם מבוטח מסוים לא מכוסה בכיסוי — isCovered=false.
- שים לב: חילוץ הטקסט משטח טבלאות לרצף שורות. סכומי המטריצה מופיעים לרוב כשלשות חוזרות בסדר: סכום, ואחריו "ש\"ח", ואחריו תווית המבוטח שאליו הסכום שייך. למשל הרצף: 85000 / ש"ח / מועמד ראשי / 50000 / ש"ח / מועמד שני / 50000 / ש"ח / ילד 1 / 50000 / ש"ח / ילד 2 — פירושו מועמד ראשי=85000, מועמד שני=50000, ילד 1=50000, ילד 2=50000.
- סמני סימון בודדים (•, Ο, C) עשויים להופיע באמצע הרצף הזה ולהפריד בין סכום לתווית שלו. התעלם מהם לצורך השיוך — הם מסמנים בחירה בטופס, ואינם מפרידים בין הסכום לתווית שאחריו.
- ספור את הסכומים ואת התוויות: אל תדלג על סכום שמופיע בטקסט ואל תשאיר מבוטח ריק כל עוד נותר סכום לא משויך ברצף. תווית שאין אחריה סכום (למשל "ש\"ח" ללא מספר) פירושה שהמבוטח הזה לא מכוסה — רק אז isCovered=false.
- הפרד בין productMaximum (תקרת מוצר / מקסימום כללי) לבין הסכום האישי של מבוטח ב-persons[].sumInsured. אל תכניס תקרת מוצר כסכום של מבוטח.
- לכל ערך ועמודה, ציין sourcePage ו-sourceText מהמסמך כדי שניתן יהיה להצביע על המקור.
- plainExplanation: הסבר קצר בעברית פשוטה וברורה.
- אם מידע מסוים לא מופיע, השאר את השדה ההוא ריק. אל תנחש.
- overallSummary: סיכום כללי בעברית פשוטה, המבוסס אך ורק על הטקסט.

טקסט הפוליסה שחולץ:
${contextText}`;
}

function normalizeInsuredPerson(p) {
  return {
    role: p.role || 'מבוטח ראשי',
    fullName: p.fullName || '',
    identificationNumber: p.identificationNumber || '',
    sourcePage: p.sourcePage != null ? Number(p.sourcePage) : null,
    sourceText: p.sourceText || '',
    confidence: p.confidence || 'medium'
  };
}

function normalizeCoveragePerson(p) {
  return {
    role: p.role || 'מבוטח ראשי',
    isCovered: p.isCovered !== false,
    sumInsured: p.sumInsured || '',
    extensions: p.extensions || '',
    sourcePage: p.sourcePage != null ? Number(p.sourcePage) : null,
    sourceClause: p.sourceClause || '',
    sourceText: p.sourceText || ''
  };
}

function normalizeCoverage(c) {
  const persons = Array.isArray(c.persons) && c.persons.length
    ? c.persons.map(normalizeCoveragePerson)
    : [{ role: 'מבוטח ראשי', isCovered: true, sumInsured: c.benefit || '', extensions: '', sourcePage: c.sourcePage != null ? Number(c.sourcePage) : null, sourceClause: c.sourceClause || '', sourceText: c.sourceText || '' }];
  return {
    name: c.name || '',
    benefit: c.benefit || '',
    productMaximum: c.productMaximum || '',
    conditions: c.conditions || '',
    exclusions: c.exclusions || '',
    waitingPeriod: c.waitingPeriod || '',
    eligibility: '',
    sourcePage: c.sourcePage != null ? Number(c.sourcePage) : null,
    sourceClause: c.sourceClause || '',
    sourceText: c.sourceText || '',
    plainExplanation: c.plainExplanation || '',
    persons
  };
}

function buildFallbackSummary(metadata, coverages, sections) {
  const parts = [];
  if (metadata.insurerName) parts.push(`חברת הביטוח: ${metadata.insurerName}.`);
  if (metadata.policyName) parts.push(`מוצר הביטוח: ${metadata.policyName}.`);
  if (metadata.insurancePeriod) parts.push(`תקופת הביטוח: ${metadata.insurancePeriod}.`);
  if (coverages.length > 0) {
    parts.push(`זיהינו ${coverages.length} כיסויים בפוליסה:`);
    for (const c of coverages) {
      let line = `• ${c.name}`;
      if (c.benefit) line += ` — ${c.benefit}`;
      if (c.sourcePage != null) line += ` (עמוד ${c.sourcePage}${c.sourceClause ? ', סעיף ' + c.sourceClause : ''})`;
      parts.push(line);
    }
  } else if (sections.length > 0) {
    parts.push(`קראנו את הפוליסה (${sections.length} עמודים), אך לא זיהינו כיסויים מפורטים במסמך.`);
  }
  parts.push('ההסברים מבוססים אך ורק על התוכן שחולץ מהמסמך שהעלית.');
  return parts.join('\n');
}