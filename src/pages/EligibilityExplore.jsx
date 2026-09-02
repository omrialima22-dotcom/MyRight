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

export default function EligibilityExplore() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const policyId = searchParams.get("policy");

  const [policy, setPolicy] = useState(null);
  const [healthEvent, setHealthEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exploring, setExploring] = useState(false);
  const [ran, setRan] = useState(false);
  const [items, setItems] = useState([]);
  const [states, setStates] = useState({});
  const [activeIndex, setActiveIndex] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sourceModal, setSourceModal] = useState(null);

  useEffect(() => {
    (async () => {
      if (!policyId) { setLoading(false); return; }
      try { const p = await base44.entities.Policy.get(policyId); setPolicy(p); } catch {}
      try {
        const recent = await base44.entities.HealthEvent.list("-created_date", 1);
        if (recent && recent[0]) setHealthEvent(recent[0]);
      } catch {}
      setLoading(false);
    })();
  }, [policyId]);

  const runExploration = async () => {
    setExploring(true);
    try {
      const res = await base44.functions.invoke("exploreEligibility", {
        policy_id: policyId,
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
        init[it.coverage_index] = {
          questionsCount: (it.questions || []).length,
          answers: [],
          match: null,
          claimId: null
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
    if (policy && healthEvent && !ran && !exploring) runExploration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy, healthEvent]);

  const activeItem = items.find((it) => it.coverage_index === activeIndex);
  const activeState = states[activeIndex];

  const evaluateMatch = async (answers) => {
    setEvaluating(true);
    // Persist the confirmed answers so claim prep can reuse them.
    setStates((prev) => ({
      ...prev,
      [activeIndex]: { ...prev[activeIndex], answers: answers || [] }
    }));
    try {
      const coverage = policy.coverages[activeItem.coverage_index];
      const res = await base44.functions.invoke("checkEligibilityMatch", {
        coverage,
        answers: answers || [],
        event_summary: healthEvent?.summary || healthEvent?.story
      });
      const data = res.data || res;
      if (data.error) {
        toast({ title: "הבדיקה נכשלה", description: data.error, variant: "destructive" });
      } else {
        setStates((prev) => ({ ...prev, [activeIndex]: { ...prev[activeIndex], match: data } }));
      }
    } catch (e) {
      toast({ title: "הבדיקה נכשלה", description: e.message, variant: "destructive" });
    }
    setEvaluating(false);
  };

  const prepareClaim = async () => {
    setCreating(true);
    try {
      const coverage = policy.coverages[activeItem.coverage_index];
      const title = `תביעה: ${activeItem.coverage_name}`;
      const description = healthEvent?.summary || healthEvent?.story || "";
      const match = activeState.match;
      const claim = await base44.entities.Claim.create({
        title,
        description,
        policy_id: policy.id,
        status: "preparing",
        coverage_name: activeItem.coverage_name,
        coverage_benefit: match?.benefit || activeItem.benefit || "",
        source_clause: activeItem.source_clause || coverage?.sourceClause || "",
        source_page: activeItem.source_page ?? coverage?.sourcePage ?? null,
        eligibility_summary: match?.explanation || "",
        user_answers: activeState.answers,
        health_event_id: healthEvent?.id || null
      });
      // Build a coverage-grounded checklist.
      try {
        const cl = await base44.functions.invoke("generateChecklist", {
          claim_title: title,
          claim_description: description,
          policy_type: policy.policy_type,
          coverage_name: activeItem.coverage_name,
          coverage_conditions: coverage?.conditions || "",
          source_clause: activeItem.source_clause || coverage?.sourceClause || "",
          policy_requirements: activeItem.policy_requirements || "",
          eligibility_summary: match?.explanation || ""
        });
        const checklist = cl.data?.checklist || cl.checklist || [];
        if (checklist.length) {
          await base44.entities.Claim.update(claim.id, { checklist });
        }
      } catch {}
      setStates((prev) => ({ ...prev, [activeIndex]: { ...prev[activeIndex], claimId: claim.id } }));
      toast({ title: "התביעה נוצרה — מכינים את החבילה" });
      navigate(`/claims/${claim.id}`);
    } catch (e) {
      toast({ title: "יצירת התביעה נכשלה", description: e.message, variant: "destructive" });
    }
    setCreating(false);
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

  if (!policyId || !policy) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-5 py-12 text-center">
          <p className="text-muted-foreground mb-4">לא נבחרה פוליסה לבדיקה.</p>
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
            ספר לנו בקצרה על האירוע הבריאותי, ואחרי שנקרא את הפוליסה נדע להצביע על מה שכדאי לבדוק.
          </p>
          <Button size="lg" onClick={() => navigate("/rights-check")}>ספר לנו מה קרה</Button>
        </div>
      </Layout>
    );
  }

  const showList = activeIndex == null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12 min-w-0">
        {showList && (
          <div className="mb-6">
            <h1 className="font-heading text-2xl lg:text-3xl font-bold mb-2">מצאנו כמה דברים שכדאי לבדוק</h1>
            <p className="text-muted-foreground leading-relaxed">
              עברנו על הפוליסה של {policy.insurance_company || "חברת הביטוח"} מול מה שסיפרת. אלה הכיסויים שעשויים להיות רלוונטיים למקרה שלך.
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
        ) : showList ? (
          <CheckList
            items={items}
            states={states}
            onCheck={(it) => setActiveIndex(it.coverage_index)}
            onShowSource={(it) => setSourceModal(it)}
          />
        ) : activeState?.match ? (
          <MatchResult
            match={activeState.match}
            coverage={activeItem}
            policy={policy}
            onPrepareClaim={prepareClaim}
            onBack={() => setActiveIndex(null)}
            creating={creating}
          />
        ) : (
          <CoverageCheckFlow
            item={activeItem}
            initialAnswers={activeState?.answers || []}
            onSubmit={evaluateMatch}
            onBack={() => setActiveIndex(null)}
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