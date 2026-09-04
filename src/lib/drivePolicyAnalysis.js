import { base44 } from "@/api/base44Client";

// The analysis runs as several short backend calls instead of one long one:
// analyzePolicy reads the document, then analyzePolicyBatch is called
// repeatedly — each call handles a few page-batches and saves its progress.
// Every stage saves what it finished, so nothing is lost if a single request
// times out on the way back to the browser.
const MAX_BATCH_CALLS = 80;

const getPolicy = (id) => base44.entities.Policy.get(id).catch(() => null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A request can time out in the browser while the backend keeps working and
// saves its result. So instead of giving up on an invoke error, we watch the
// saved state and continue as soon as it moves forward.
async function waitForProgress(policyId, isDone, timeoutMs = 240000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await sleep(4000);
    const fresh = await getPolicy(policyId);
    if (!fresh) return null;
    if (isDone(fresh)) return fresh;
    if (fresh.extraction_status === "failed" || fresh.extraction_status === "unreadable") return fresh;
  }
  return null;
}

export async function drivePolicy(policyId) {
  let policy = await getPolicy(policyId);
  if (!policy) return;

  const needsRead =
    policy.extraction_status === "pending" ||
    policy.analysis_stage === "reading" ||
    (!policy.analysis_stage && (policy.document_sections || []).length === 0);

  if (needsRead) {
    try {
      await base44.functions.invoke("analyzePolicy", { policy_id: policyId });
      policy = await getPolicy(policyId);
    } catch {
      policy = await waitForProgress(policyId, (p) => p.analysis_stage === "coverages" || p.analysis_stage === "done");
    }
    if (!policy) return;
  }

  let calls = 0;
  while (policy && policy.analysis_stage === "coverages" && calls < MAX_BATCH_CALLS) {
    calls += 1;
    const cursorBefore = Number(policy.batch_cursor || 0);
    try {
      await base44.functions.invoke("analyzePolicyBatch", { policy_id: policyId });
      policy = await getPolicy(policyId);
    } catch {
      policy = await waitForProgress(
        policyId,
        (p) => Number(p.batch_cursor || 0) > cursorBefore || p.analysis_stage === "done"
      );
    }
    if (!policy) return;
  }
}