import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import CheckList from "@/components/eligibility/CheckList";
import CoverageCheckFlow from "@/components/eligibility/CoverageCheckFlow";
import MatchResult from "@/components/eligibility/MatchResult";
import FinalSummary from "@/components/eligibility/FinalSummary";

export default function EligibilityExplore() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [policies, setPolicies] = useState([]);
  const [healthEvent, setHealthEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exploring, setExploring] = useState(false);
  const [ran, setRan] = useState(false);
  const [items, setItems] = useState([]);
  const [states, setStates] = useState({});
  const [activeKey, setActiveKey] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [packageStatus, setPackageStatus] = useState({});
  const [creatingInsurer, setCreatingInsurer] = useState(null);
  const [sourceModal, setSourceModal] = useState(null);

  const policiesMap = React.useMemo(() => {
    const m = {};
    policies.forEach((p) => { m[p.id] = p; });
    return m;
  }, [policies]);

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.Policy.list("-created_date", 50);
        const ok = (all || []).filter(
          (p) => p.extraction_status === "success" && Array.isArray(p.coverages) && p.coverages.length > 0
        );
        setPolicies(ok);
      } catch {}
      try {
        const recent = await base44.entities.HealthEvent.list("-created_date", 1);
        if (recent && recent[0]) setHealthEvent(recent[0]);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const runExploration = async () => {
    setExploring(true);
    try {
      const res = await base44.functions.invoke("exploreEligibility", {
        policy_ids: policies.map((p) => p.id),
        health_event_id: healthEvent?.id
      });
      const data = res.data || res;
      if (data.error === "no_health_event") {
        setHealthEvent(null);
        setRan(true);
        setExploring(false);
        return;
      }
      if (data.error) {
        toast({ title: "משהו השתבש", description: data.error, variant: "destructive" });
      }
      const its = data.items || [];
      setItems(its);
      const init = {};
      its.forEach((it) => {
        init[it.key] = {
          questionsCount: (it.questions || []).length,
          answers: [],
          match: null
        };
      });
      setStates(init);
    } catch (e) {
      toast({ title: "משהו השתבש", description: e.message, variant: "destructive" });
    }
    setRan(true);
    setExploring(false);
  };

  useEffect(() => {
    if (policies.length > 0 && healthEvent && !ran && !exploring) runExploration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies, healthEvent]);

  const activeItem = items.find((it) => it.key === activeKey);
  const activeState = states[activeKey];
  const activePolicy = activeItem ? policiesMap[activeItem.policy_id] : null;

  const evaluateMatch = async (answers) => {
    setEvaluating(true);
    setStates((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], answers: answers || [] }
    }));
    try {
      const coverage = activePolicy.coverages[activeItem.coverage_index];
      const res = await base44.functions.invoke("checkEligibilityMatch", {
        coverage,
        answers: answers || [],
        event_summary: healthEvent?.summary || healthEvent?.story
      });
      const data = res.data || res;
      if (data.error) {
        toast({ title: "הבדיקה נכשלה", description: data.error, variant: "destructive" });
      } else {
        setStates((prev) => ({ ...prev, [activeKey]: { ...prev[activeKey], match: data } }));
      }
    } catch (e) {
      toast({ title: "הבדיקה נכשלה", description: e.message, variant: "destructive" });
    }
    setEvaluating(false);
  };

  const continueToNext = () => {
    const idx = items.findIndex((it) => it.key === activeKey);
    if (idx >= 0 && idx + 1 < items.length) {
      setActiveKey(items[idx + 1].key);
    } else {
      setActiveKey(null);
    }
  };

  const allReviewed = items.length > 0 && items.every((it) => states[it.key]?.match);

  const preparePackage = async (insurer) => {
    setCreatingInsurer(insurer);
    try {
      const potentialItems = items.filter(
        (it) => (it.insurer || "חברת ביטוח") === insurer && states[it.key]?.match?.potential_match
      );
      if (potentialItems.length === 0) return;

      const coverages = potentialItems.map((it) => ({
        name: it.coverage_name,
        benefit: states[it.key]?.match?.benefit || it.benefit || "",
        conditions: it.conditions || "",
        source_clause: it.source_clause,
        source_page: it.source_page,
        source_text: it.source_text,
        policy_requirements: it.policy_requirements,
        relevance_reason: it.relevance_reason,
        eligibility_summary: states[it.key]?.match?.explanation || "",
        user_answers: states[it.key]?.answers || []
      }));

      const firstPolicy = policiesMap[potentialItems[0].policy_id];
      const description = healthEvent?.summary || healthEvent?.story || "";

      const claim = await base44.entities.Claim.create({
        title: `חבילת תביעה — ${insurer}`,
        description,
        policy_id: potentialItems[0].policy_id,
        insurer,
        status: "preparing",
        coverages,
        health_event_id: healthEvent?.id || null
      });

      try {
        const pkg = await base44.functions.invoke("generateClaimPackage", {
          insurer,
          policy_type: firstPolicy?.policy_type,
          coverages
        });
        const data = pkg.data || pkg;
        const shared = (data.shared_documents || []).map((d) => ({
          text: d.text, category: d.category, group: "shared", done: false
        }));
        const perCov = [];
        (data.per_coverage || []).forEach((pc) => {
          (pc.documents || []).forEach((d) => {
            perCov.push({ text: d.text, category: d.category, group: pc.coverage_name, done: false });
          });
        });
        const checklist = [...shared, ...perCov];
        await base44.entities.Claim.update(claim.id, {
          checklist,
          doctor_letter: data.doctor_request || "",
          claim_letter: data.claim_letter || ""
        });
      } catch (e) {
        toast({ title: "הכנת המסמכים נכשלה", description: e.message, variant: "destructive" });
      }

      setPackageStatus((prev) => ({ ...prev, [insurer]: claim.id }));
      toast({ title: "חבילת התביעה נוצרה" });
      navigate(`/claims/${claim.id}`);
    } catch (e) {
      toast({ title: "יצירת החבילה נכשלה", description: e.message, variant: "destructive" });
    }
    setCreatingInsurer(null);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin ml-2" /> טוען…
        </div>
      </Layout>
    );
  }

  if (policies.length === 0) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-5 py-12 text-center">
          <p className="text-muted-foreground mb-4">עדיין אין לנו פוליסות מנותחות לבדיקה.</p>
          <Button onClick={() => navigate("/policies")}>לרשימת הפוליסות</Button>
        </div>
      </Layout>
    );
  }

  if (!healthEvent) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-5 py-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-tint-blue mb-4">
            <Sparkles className="w-7 h-7 text-accent" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-2">כדי לבדוק מה רלוונטי אליך, נספר קודם מה קרה</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
            ספר לנו בקצרה על האירוע הבריאותי, ואחרי שנקרא את הפוליסות נדע להצביע על מה שכדאי לבדוק.
          </p>
          <Button size="lg" onClick={() => navigate("/rights-check")}>ספר לנו מה קרה</Button>
        </div>
      </Layout>
    );
  }

  const showList = activeKey == null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12 min-w-0">
        {showList && !allReviewed && (
          <div className="mb-6">
            <h1 className="font-heading text-2xl lg:text-3xl font-bold mb-2">
              מצאנו {items.length} דברים שכדאי לבדוק
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              עברנו על הפוליסות והשווינו אותן למה שסיפרת לנו. נעבור יחד על כל אחד מהם.
            </p>
          </div>
        )}

        {exploring ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin ml-2" /> בודקים אילו כיסויים עשויים להיות רלוונטיים…
          </div>
        ) : ran && items.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground mb-4">לא מצאנו כיסויים שעשויים להיות רלוונטיים למקרה שתיארת.</p>
            <Button variant="outline" onClick={() => navigate("/policies")}>חזרה לפוליסות</Button>
          </div>
        ) : showList && allReviewed ? (
          <FinalSummary
            items={items}
            states={states}
            onPreparePackage={preparePackage}
            packageStatus={packageStatus}
            onShowSource={(it) => setSourceModal(it)}
            creatingInsurer={creatingInsurer}
          />
        ) : showList ? (
          <CheckList
            items={items}
            states={states}
            onCheck={(it) => setActiveKey(it.key)}
            onShowSource={(it) => setSourceModal(it)}
          />
        ) : activeState?.match ? (
          <MatchResult
            match={activeState.match}
            coverage={activeItem}
            policy={activePolicy}
            onContinue={continueToNext}
            isLast={items.findIndex((it) => it.key === activeKey) === items.length - 1}
            onBack={() => setActiveKey(null)}
            loading={evaluating}
          />
        ) : (
          <CoverageCheckFlow
            item={activeItem}
            initialAnswers={activeState?.answers || []}
            onSubmit={evaluateMatch}
            onBack={() => setActiveKey(null)}
            loading={evaluating}
          />
        )}
      </div>

      {sourceModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setSourceModal(null)}>
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold break-words">{sourceModal.coverage_name}</h3>
              <button onClick={() => setSourceModal(null)} className="text-muted-foreground shrink-0">✕</button>
            </div>
            {sourceModal.source_clause && (
              <p className="text-sm text-muted-foreground mb-2">
                סעיף {sourceModal.source_clause}{sourceModal.source_page != null ? ` · עמוד ${sourceModal.source_page}` : ""}
              </p>
            )}
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
              {sourceModal.source_text || "לא שמרנו את הנוסח המקורי."}
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}