import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { base44 } from "@/api/base44Client";
import AnalysisHero from "@/components/analysis/AnalysisHero";
import GeneralProgress from "@/components/analysis/GeneralProgress";
import PolicyRoster from "@/components/analysis/PolicyRoster";
import DiscoveryFeed from "@/components/analysis/DiscoveryFeed";
import AnalysisComplete from "@/components/analysis/AnalysisComplete";
import AnalysisFailure from "@/components/analysis/AnalysisFailure";
import IdentityStep from "@/components/eligibility/IdentityStep";
import { Button } from "@/components/ui/button";
import {
  deriveStage,
  progressStates,
  deriveDiscoveries,
  countCoverages,
  countFailed,
  allComplete
} from "@/lib/analysis";

const POLL_INTERVAL = 3000;
const MAX_POLLS = 90; // ~4.5 min safety net before declaring a stall

export default function LiveAnalysis() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get("ids") || "").split(",").filter(Boolean);
  const idsKey = ids.join(",");
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stalled, setStalled] = useState(false);
  const pollsRef = useRef(0);
  const triggeredRef = useRef(false);

  const fetchAll = useCallback(async () => {
    const results = await Promise.all(
      ids.map((id) => base44.entities.Policy.get(id).catch(() => null))
    );
    return results.filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // No policies to track — go back to the list.
  useEffect(() => {
    if (ids.length === 0) navigate("/policies", { replace: true });
  }, [ids.length, navigate]);

  // Initial load + trigger real analysis for not-yet-started policies (once).
  useEffect(() => {
    let mounted = true;
    (async () => {
      const initial = await fetchAll();
      if (!mounted) return;
      setPolicies(initial);
      setLoading(false);
      if (!triggeredRef.current) {
        triggeredRef.current = true;
        initial
          .filter((p) => p.extraction_status === "pending")
          .forEach((p) => {
            base44.functions
              .invoke("analyzePolicy", { policy_id: p.id })
              .catch(() => {});
          });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchAll]);

  const complete = allComplete(policies);

  // Poll for real, saved progress.
  useEffect(() => {
    if (loading || complete) return;
    const t = setInterval(async () => {
      pollsRef.current += 1;
      if (pollsRef.current >= MAX_POLLS) {
        setStalled(true);
        clearInterval(t);
        return;
      }
      const fresh = await fetchAll();
      setPolicies(fresh);
    }, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [loading, complete, fetchAll]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-5 py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const firstSuccessId = policies.find((p) => p.extraction_status === "success")?.id;
  const stage = deriveStage(policies);
  const steps = progressStates(stage);
  const discoveries = deriveDiscoveries(policies);
  const coverageCount = countCoverages(policies);
  const failedCount = countFailed(policies);

  const showComplete = complete && !stalled;
  const showStalled = stalled && !complete;

  // Family / multi-insured policy → ask who the user is before showing results.
  const identityPolicy = policies.find(
    (p) =>
      p.extraction_status === "success" &&
      Array.isArray(p.insured_people) &&
      p.insured_people.length > 1 &&
      !p.confirmed_insured_role
  );

  const confirmIdentity = async (role, name) => {
    const updated = {
      confirmed_insured_role: role,
      confirmed_insured_name: name || "",
      confirmed_at: new Date().toISOString()
    };
    try {
      await base44.entities.Policy.update(identityPolicy.id, updated);
    } catch { /* keep the UI moving; the eligibility flow re-asks if it failed */ }
    setPolicies((prev) => prev.map((p) => (p.id === identityPolicy.id ? { ...p, ...updated } : p)));
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12">
        {showComplete && identityPolicy ? (
          <IdentityStep policy={identityPolicy} onConfirm={confirmIdentity} />
        ) : showComplete ? (
          <div className="space-y-4">
            <AnalysisComplete
              policies={policies}
              onDone={() => navigate("/eligibility")}
            />
            {failedCount > 0 && (
              <AnalysisFailure
                count={failedCount}
                onReupload={() => navigate("/policies")}
              />
            )}
          </div>
        ) : showStalled ? (
          <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-soft text-center">
            <h2 className="font-heading text-xl font-bold mb-2">הקריאה אורכת יותר זמן מהצפוי</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
              אנחנו עדיין עובדים על המסמכים. אפשר להמתין, או לחזור לרשימת הפוליסות ולהמשיך משם.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => navigate("/policies")}>
                חזרה לפוליסות
              </Button>
            </div>
          </div>
        ) : (
          <>
            <AnalysisHero />
            <div className="space-y-4">
              <GeneralProgress steps={steps} />
              <PolicyRoster policies={policies} />
              <div>
                <h2 className="font-heading text-lg font-semibold mb-3">מה מצאנו עד עכשיו</h2>
                <DiscoveryFeed discoveries={discoveries} coverageCount={coverageCount} />
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}