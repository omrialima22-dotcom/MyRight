import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildContextBatches } from "../../shared/policyAnalysis.ts";

// STAGE 1 ONLY — read the actual PDF text and save it, then hand off to
// analyzePolicyBatch (called repeatedly by the client) for the coverage
// extraction. Doing everything in one request exceeded the platform's 120s
// request window on real policies and the whole analysis was lost.
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
          pageNumber: { type: "number" },
          text: { type: "string" }
        }
      }
    }
  }
};

const UNREADABLE_MESSAGE =
  "לא הצלחנו לקרוא את תוכן הפוליסה בצורה אמינה. ייתכן שמדובר בקובץ סרוק ללא שכבת טקסט. כדי ש-MyRight תוכל לנתח את הפוליסה, מומלץ להעלות גרסה חיפושית (PDF עם שכבת טקסט) של המסמך. אנחנו לא רוצים לנחש עבורך.";

function friendlyError(message) {
  const m = String(message || '');
  if (m.includes('120-second') || m.toLowerCase().includes('timeout')) {
    return 'קריאת המסמך ארכה יותר מהזמן המותר לבקשה אחת. אפשר לנסות שוב, ואם המסמך גדול מאוד — להעלות אותו מפוצל לקבצים קטנים יותר.';
  }
  return m || 'שגיאה לא צפויה במהלך הניתוח';
}

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

    await base44.entities.Policy.update(policy_id, {
      extraction_status: 'processing',
      extraction_issues: '',
      analysis_stage: 'reading',
      batch_cursor: 0,
      batch_total: 0,
      coverages: [],
      insured_people: []
    });

    const stage1Start = Date.now();
    const read = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: policy.file_url,
      json_schema: READ_SCHEMA
    });
    console.log(`Stage 1 (read PDF) took ${Date.now() - stage1Start}ms`);

    if (!read || read.status !== 'success' || !read.output) {
      await base44.entities.Policy.update(policy_id, {
        extraction_status: 'unreadable',
        analysis_stage: 'done',
        extraction_issues: (read && read.details) || 'לא הצלחנו לקרוא את תוכן הקובץ'
      });
      return Response.json({ status: 'unreadable', message: UNREADABLE_MESSAGE });
    }

    const data = read.output || {};
    const pages = Array.isArray(data.pageTexts) ? data.pageTexts : [];
    const hasText = pages.some((p) => p.text && String(p.text).trim().length > 0);

    if (data.isReadable === false || (!hasText && !data.insurerName)) {
      await base44.entities.Policy.update(policy_id, {
        extraction_status: 'unreadable',
        analysis_stage: 'done',
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

    const batchTotal = buildContextBatches(documentSections).length;

    const update = {
      document_sections: documentSections,
      policy_metadata: policyMetadata,
      extraction_issues: data.issues || '',
      analysis_stage: batchTotal > 0 ? 'coverages' : 'done',
      batch_cursor: 0,
      batch_total: batchTotal
    };
    if (batchTotal === 0) update.extraction_status = 'success';

    const placeholder = !policy.insurance_company || policy.insurance_company.indexOf('טרם זוהה') >= 0;
    if (policyMetadata.insurerName && (placeholder || !policy.insurance_company)) {
      update.insurance_company = policyMetadata.insurerName;
    }
    if (policyMetadata.policyNumber && !policy.policy_number) {
      update.policy_number = policyMetadata.policyNumber;
    }

    await base44.entities.Policy.update(policy_id, update);

    return Response.json({
      status: 'read',
      batch_total: batchTotal,
      policy_metadata: policyMetadata
    });
  } catch (error) {
    if (base44 && policyId) {
      try {
        await base44.entities.Policy.update(policyId, {
          extraction_status: 'failed',
          analysis_stage: 'done',
          extraction_issues: friendlyError(error?.message)
        });
      } catch { /* best-effort */ }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}