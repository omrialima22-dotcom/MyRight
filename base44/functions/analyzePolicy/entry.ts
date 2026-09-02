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
const COVERAGES_SCHEMA = {
  type: "object",
  properties: {
    coverages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "שם הכיסוי" },
          benefit: { type: "string", description: "סכום/קצבת הפיצוי הכתוב" },
          conditions: { type: "string", description: "תנאי זכאות" },
          exclusions: { type: "string", description: "חריגים" },
          waitingPeriod: { type: "string", description: "תקופת המתנה/אכשרה" },
          sourcePage: { type: "number", description: "מספר העמוד שבו מופיע הכיסוי" },
          sourceClause: { type: "string", description: "מספר הסעיף" },
          sourceText: { type: "string", description: "הנוסח המקורי המדויק מהפוליסה" },
          plainExplanation: { type: "string", description: "הסבר בעברית פשוטה" }
        }
      }
    },
    overallSummary: { type: "string", description: "סיכום כללי בעברית פשוטה" }
  }
};

const UNREADABLE_MESSAGE =
  "לא הצלחנו לקרוא את תוכן הפוליסה בצורה אמינה. ייתכן שמדובר בקובץ סרוק ללא שכבת טקסט. כדי ש-MyRight תוכל לנתח את הפוליסה, מומלץ להעלות גרסה חיפושית (PDF עם שכבת טקסט) של המסמך. אנחנו לא רוצים לנחש עבורך.";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { policy_id } = body;
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

    // STAGE 2: identify coverages from the extracted text (grounded, no invention).
    const contextText = buildContextText(documentSections);
    let coverages = [];
    let overallSummary = '';

    if (contextText.trim()) {
      try {
        const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: buildCoveragesPrompt(contextText),
          response_json_schema: COVERAGES_SCHEMA,
          model: 'automatic'
        });
        const result = (llm && typeof llm === 'object') ? llm : null;
        if (result) {
          coverages = Array.isArray(result.coverages) ? result.coverages.map(normalizeCoverage) : [];
          overallSummary = result.overallSummary || '';
        }
      } catch {
        // If Stage 2 fails, keep Stage 1 results; analysis uses fallback summary.
      }
    }

    const analysis = overallSummary || buildFallbackSummary(policyMetadata, coverages, documentSections);

    update.coverages = coverages;
    update.analysis = analysis;
    update.extraction_status = 'success';
    await base44.entities.Policy.update(policy_id, update);

    return Response.json({
      status: 'success',
      policy_metadata: policyMetadata,
      coverages,
      document_sections: documentSections,
      analysis
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function buildContextText(sections) {
  return sections.map((s) => {
    const page = s.pageStart != null ? `=== עמוד ${s.pageStart} ===\n` : '';
    return page + s.text;
  }).join('\n\n');
}

function buildCoveragesPrompt(contextText) {
  return `אתה מנתח פוליסות ביטוח ישראליות. להלן הטקסט שחולץ מתוך פוליסה, מאורגן לפי עמודים. הטקסט הזה הוא המקור היחיד שעליו אתה מסתמך.

חובות:
- זהה אך ורק כיסויים שמופיעים בפועל בטקסט. אל תמציא כיסויים שלא מוזכרים.
- לכל כיסוי, ציין את מספר העמוד שבו הוא מופיע (sourcePage) ואת מספר הסעיף אם ידוע (sourceClause).
- בשדה sourceText העתק את הנוסח המקורי המדויק מהפוליסה התומך בכיסוי.
- בשדה plainExplanation כתוב הסבר קצר בעברית פשוטה וברורה.
- אם מידע מסוים לא מופיע, השאר את השדה ההוא ריק. אל תנחש.
- בשדה overallSummary כתוב סיכום כללי בעברית פשוטה, המבוסס אך ורק על הטקסט.

טקסט הפוליסה שחולץ:
${contextText}`;
}

function normalizeCoverage(c) {
  return {
    name: c.name || '',
    benefit: c.benefit || '',
    conditions: c.conditions || '',
    exclusions: c.exclusions || '',
    waitingPeriod: c.waitingPeriod || '',
    eligibility: '',
    sourcePage: c.sourcePage != null ? Number(c.sourcePage) : null,
    sourceClause: c.sourceClause || '',
    sourceText: c.sourceText || '',
    plainExplanation: c.plainExplanation || ''
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