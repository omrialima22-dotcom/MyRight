import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  COVERAGES_SCHEMA,
  COVERAGES_MODEL,
  BATCHES_PER_CALL,
  buildContextBatches,
  buildContextText,
  buildCoveragesPrompt,
  buildFallbackSummary,
  mergeInsuredPeopleWithAliases,
  mergeCoverages,
  dedupeCoveragePersons,
  normalizeCoverage,
  normalizeInsuredPerson,
  runPooled
} from "../../shared/policyAnalysis.ts";

// STAGE 2, one slice at a time. Each invocation processes a few page-batches,
// merges the result into what was already saved, and advances the cursor — so a
// long policy is analyzed across several short requests instead of one request
// that hits the 120s limit and loses everything.
export default async function(req) {
  let base44;
  let policyId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { policy_id } = await req.json();
    policyId = policy_id;
    if (!policy_id) return Response.json({ error: 'חסר מזהה פוליסה' }, { status: 400 });

    const policy = await base44.entities.Policy.get(policy_id);
    if (!policy) return Response.json({ error: 'פוליסה לא נמצאה' }, { status: 404 });

    const sections = Array.isArray(policy.document_sections) ? policy.document_sections : [];
    if (sections.length === 0) {
      return Response.json({ error: 'המסמך עוד לא נקרא', stage: policy.analysis_stage || '' }, { status: 400 });
    }

    const batches = buildContextBatches(sections);
    const cursor = Number(policy.batch_cursor || 0);
    if (cursor >= batches.length) {
      return Response.json({ status: 'done', cursor, total: batches.length });
    }

    const slice = batches.slice(cursor, cursor + BATCHES_PER_CALL);
    const settled = await runPooled(slice, slice.length, (batch) =>
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildCoveragesPrompt(buildContextText(batch)),
        response_json_schema: COVERAGES_SCHEMA,
        model: COVERAGES_MODEL
      })
    );

    const newCoverageLists = [];
    const newPeopleLists = [];
    settled.forEach((s, i) => {
      if (s.status !== 'fulfilled' || !s.value || typeof s.value !== 'object') {
        console.error(
          `Batch ${cursor + i} failed (pages ${slice[i].map((x) => x.pageStart).join(',')}):`,
          s.reason?.message || s.reason
        );
        return;
      }
      const r = s.value;
      newCoverageLists.push(Array.isArray(r.coverages) ? r.coverages.map(normalizeCoverage) : []);
      newPeopleLists.push(Array.isArray(r.insuredPeople) ? r.insuredPeople.map(normalizeInsuredPerson) : []);
    });

    const existingPeople = Array.isArray(policy.insured_people) ? policy.insured_people : [];
    const existingCoverages = Array.isArray(policy.coverages) ? policy.coverages : [];

    const { people, roleAlias } = mergeInsuredPeopleWithAliases([existingPeople, ...newPeopleLists]);
    const remapped = newCoverageLists.map((list) =>
      list.map((c) => ({
        ...c,
        persons: (c.persons || []).map((p) => ({ ...p, role: roleAlias[p.role] || p.role }))
      }))
    );
    const coverages = mergeCoverages([existingCoverages, ...remapped]).map(dedupeCoveragePersons);

    const nextCursor = cursor + slice.length;
    const finished = nextCursor >= batches.length;

    const update = {
      insured_people: people,
      coverages,
      batch_cursor: nextCursor,
      batch_total: batches.length,
      analysis_stage: finished ? 'done' : 'coverages'
    };
    if (finished) {
      update.analysis = buildFallbackSummary(policy.policy_metadata || {}, coverages, sections);
      update.extraction_status = 'success';
    }
    await base44.entities.Policy.update(policy_id, update);

    return Response.json({
      status: finished ? 'done' : 'in_progress',
      cursor: nextCursor,
      total: batches.length,
      coverages_found: coverages.length
    });
  } catch (error) {
    if (base44 && policyId) {
      try {
        await base44.entities.Policy.update(policyId, {
          extraction_status: 'failed',
          analysis_stage: 'done',
          extraction_issues: error?.message || 'שגיאה במהלך זיהוי הכיסויים'
        });
      } catch { /* best-effort */ }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}