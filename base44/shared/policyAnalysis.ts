// Shared logic for the multi-step policy analysis.
// Stage 1 (analyzePolicy) reads the PDF; Stage 2 (analyzePolicyBatch) extracts
// coverages a few page-batches at a time. Splitting them is what keeps every
// single request well inside the platform's 120s request window — one long
// all-in-one request used to time out and the whole analysis was lost.

export const COVERAGES_SCHEMA = {
  type: "object",
  properties: {
    insuredPeople: {
      type: "array",
      description: "כל המבוטחים בפוליסה לפי התוויות שמופיעות במסמך (מבוטח ראשי, מבוטח שני, ילד 1 וכו'). אם מדובר באדם אחד — מערך בן פריט אחד.",
      items: {
        type: "object",
        properties: {
          role: { type: "string" },
          fullName: { type: "string" },
          identificationNumber: { type: "string" },
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
          name: { type: "string" },
          benefit: { type: "string" },
          productMaximum: { type: "string" },
          conditions: { type: "string" },
          exclusions: { type: "string" },
          waitingPeriod: { type: "string" },
          sourcePage: { type: "number" },
          sourceClause: { type: "string" },
          sourceText: { type: "string" },
          plainExplanation: { type: "string" },
          persons: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                isCovered: { type: "boolean" },
                sumInsured: { type: "string" },
                extensions: { type: "string" },
                sourcePage: { type: "number" },
                sourceClause: { type: "string" },
                sourceText: { type: "string" }
              },
              required: ["role", "isCovered"]
            }
          }
        },
        required: ["name", "persons"]
      }
    },
    overallSummary: { type: "string" }
  }
};

export const COVERAGES_MODEL = 'gemini_3_1_pro';

// Batch size: small enough that a handful of batches finish comfortably inside
// one request window.
export const CONTEXT_BATCH_CHAR_LIMIT = 6000;

// How many batches one analyzePolicyBatch invocation processes. Kept low so the
// invocation always returns long before the 120s limit; the client calls it
// repeatedly until the cursor reaches the end.
export const BATCHES_PER_CALL = 2;

export function buildContextText(sections) {
  return sections.map((s) => {
    const page = s.pageStart != null ? `=== עמוד ${s.pageStart} ===\n` : '';
    return page + s.text;
  }).join('\n\n');
}

export function buildContextBatches(sections) {
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
  return batches.filter((b) => buildContextText(b).trim());
}

export function normalizeName(s) {
  return String(s || '').replace(/[\s\u200f\u200e\-–—,.:"'()]/g, '').toLowerCase();
}

export function mergeInsuredPeopleWithAliases(peopleLists) {
  const confidenceRank = { high: 3, medium: 2, low: 1 };
  const byKey = new Map();
  const order = [];
  const roleAlias = {};
  for (const list of peopleLists) {
    for (const p of list) {
      // Role label is the canonical join key — coverages reference people by
      // role, and batches often report the same role with the name missing.
      const key = normalizeName(p.role) || normalizeName(p.fullName) || '';
      if (!byKey.has(key)) {
        byKey.set(key, p);
        order.push(key);
      } else {
        const existing = byKey.get(key);
        if ((confidenceRank[p.confidence] || 0) > (confidenceRank[existing.confidence] || 0)) {
          byKey.set(key, p);
        } else if (!existing.fullName && p.fullName) {
          existing.fullName = p.fullName;
        }
      }
      roleAlias[p.role || ''] = byKey.get(key).role || '';
    }
  }
  return { people: order.map((key) => byKey.get(key)), roleAlias };
}

export function mergeCoverages(coverageLists) {
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

export function dedupeCoveragePersons(c) {
  if (!Array.isArray(c.persons) || c.persons.length <= 1) return c;
  const byRole = new Map();
  for (const p of c.persons) {
    const key = p.role || '';
    const existing = byRole.get(key);
    if (!existing || (!existing.sumInsured && p.sumInsured)) byRole.set(key, p);
  }
  return { ...c, persons: Array.from(byRole.values()) };
}

export function normalizeInsuredPerson(p) {
  return {
    role: p.role || 'מבוטח ראשי',
    fullName: p.fullName || '',
    identificationNumber: p.identificationNumber || '',
    sourcePage: p.sourcePage != null ? Number(p.sourcePage) : null,
    sourceText: p.sourceText || '',
    confidence: p.confidence || 'medium'
  };
}

export function normalizeCoveragePerson(p) {
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

export function normalizeCoverage(c) {
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

export function buildCoveragesPrompt(contextText) {
  return `אתה מנתח פוליסות ביטוח ישראליות. להלן הטקסט שחולץ מתוך פוליסה, מאורגן לפי עמודים. הטקסט הזה הוא המקור היחיד שעליו אתה מסתמך.

שלב א' — זיהוי מבוטחים (insuredPeople):
- זהה את כל המבוטחים בפוליסה לפי התוויות שמופיעות במסמך (מבוטח ראשי, מבוטח שני, ילד 1, ילד 2 וכו').
- אם מופיע רק אדם אחד — החזר מערך בן פריט אחד.
- אל תנחש מי מהם המשתמש. רק תעד את מה שכתוב. אל תנחש שמות או מספרי זהות שלא מופיעים.

שלב ב' — כיסויים לפי מבוטח (coverages):
- זהה אך ורק כיסויים שמופיעים בפועל בטקסט. אל תמציא כיסויים שלא מוזכרים.
- פוליסות רבות מציגות טבלת מטריצה: שורות = כיסויים, עמודות = מבוטחים. חובה לשמור את הקשר שורה + עמודה + ערך. אל תשטח טבלה לערך גלובלי אחד שלא שייך לעמודה מסוימת.
- לכל כיסוי, מלא persons: פריט לכל מבוטח עם הסכום/הבחירה שחלים עליו באותה עמודה.
- isCovered=false אך ורק כשיש עדות מפורשת במסמך לכך שהמבוטח אינו מכוסה בכיסוי הזה (כתוב "ללא כיסוי", מקף, "לא רלוונטי", או שהטבלה קריאה ובה תא ריק לעמודה שלו לעומת סכומים לאחרים).
- אם פשוט לא הצלחת לקרוא את הנתון — אל תסמן isCovered=false. השאר את הפריט של אותו מבוטח בחוץ לגמרי. סימון שגוי של "לא מכוסה" מוחק מהמשתמש זכות אמיתית, וזו התוצאה הגרועה ביותר.
- שים לב: חילוץ הטקסט משטח טבלאות לרצף שורות. סכומי המטריצה מופיעים לרוב כשלשות חוזרות בסדר: סכום, ואחריו "ש\"ח", ואחריו תווית המבוטח שאליו הסכום שייך.
- סמני סימון בודדים (•, Ο, C) עשויים להופיע באמצע הרצף הזה ולהפריד בין סכום לתווית שלו. התעלם מהם לצורך השיוך.
- ספור את הסכומים ואת התוויות: אל תדלג על סכום שמופיע בטקסט ואל תשאיר מבוטח ריק כל עוד נותר סכום לא משויך ברצף.
- הפרד בין productMaximum (תקרת מוצר / מקסימום כללי) לבין הסכום האישי של מבוטח ב-persons[].sumInsured.
- לכל ערך ועמודה, ציין sourcePage ו-sourceText מהמסמך.
- plainExplanation: הסבר קצר בעברית פשוטה וברורה.
- אם מידע מסוים לא מופיע, השאר את השדה ההוא ריק. אל תנחש.
- overallSummary: סיכום כללי בעברית פשוטה, המבוסס אך ורק על הטקסט.

טקסט הפוליסה שחולץ:
${contextText}`;
}

export function buildFallbackSummary(metadata, coverages, sections) {
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

export async function runPooled(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: 'fulfilled', value: await task(items[i]) };
      } catch (e) {
        results[i] = { status: 'rejected', reason: e };
      }
    }
  });
  await Promise.all(workers);
  return results;
}