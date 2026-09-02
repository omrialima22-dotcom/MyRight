import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlobalQuestionFlow from "@/components/eligibility/GlobalQuestionFlow";
import FinalSummary from "@/components/eligibility/FinalSummary";

export default function EligibilityExplore() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [policies, setPolicies] = useState([]);
  const [healthEvent, setHealthEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [items, setItems] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [answeredFacts, setAnsweredFacts] = useState([]); // [{fact_key, value, prompt, answer_type, options}]
  const [editIndex, setEditIndex] = useState(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcDone, setRecalcDone] = useState(false);
  const [packageStatus, setPackageStatus] = useState({});
  const [creatingInsurer, setCreatingInsurer] = useState(null);
  const [sourceModal, setSourceModal] = useState(null);

  const policiesMap = React.useMemo(() => {
    const m = {};
    policies.forEach((p) => { m[p.id] = p; });
    return m;
  }, [policies]);

  const pastFacts = React.useMemo(
    () => (healthEvent?.facts || []).map((f) => ({ fact_key: f.fact_key, value: f.value })),
    [healthEvent]
  );

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

  const runDiscovery = async () => {
    setDiscovering(true);
    try {
      const res = await base44.functions.invoke("exploreEligibility", {
        policy_ids: policies.map((p) => p.id),
        health_event_id: healthEvent?.id
      });
      const data = res.data || res;
      if (data.error === "no_health_event") {
        setHealthEvent(null);
        setDiscovering(false);
        return;
      }
      if (data.error) {
        toast({ title: "משהו השתבש", description: data.error, variant: "destructive" });
      }
      setItems(data.items || []);
      return data.items || [];
    } catch (e) {
      toast({ title: "משהו השתבש", description: e.message, variant: "destructive" });
    }
    setDiscovering(false);
    return null;
  };

  const factsForRecalc = (currentAnswered) => {
    const map = {};
    pastFacts.forEach((f) => { map[f.fact_key] = f.value; });
    currentAnswered.forEach((f) => { map[f.fact_key] = f.value; });
    return Object.keys(map).map((k) => ({ fact_key: k, value: map[k] }));
  };

  const persistFacts = async (currentAnswered) => {
    if (!healthEvent?.id) return;
    const map = {};
    pastFacts.forEach((f) => { map[f.fact_key] = f.value; });
    currentAnswered.forEach((f) => { map[f.fact_key] = f.value; });
    const facts = Object.keys(map).map((k) => ({
      fact_key: k, value: map[k], certainty: "confirmed", source: "user"
    }));
    try {
      await base44.entities.HealthEvent.update(healthEvent.id, { facts });
    } catch {}
  };

  const runRecalc = async (coverages, currentAnswered) => {
    setRecalcLoading(true);
    try {
      const res = await base44.functions.invoke("recalcReviewPlan", {
        coverages,
        facts: factsForRecalc(currentAnswered),
        event_summary: healthEvent?.summary || "",
        event_story: healthEvent?.story || "",
        event_answers: healthEvent?.answers || []
      });
      const data = res.data || res;
      if (data.error) {
        toast({ title: "עדכון התוכנית נכשל", description: data.error, variant: "destructive" });
      } else {
        const statusMap = {};
        (data.coverages || []).forEach((c) => { statusMap[c.key] = c; });
        setItems(coverages.map((c) => ({
          ...c,
          status: statusMap[c.key]?.status || "unknown",
          explanation: statusMap[c.key]?.explanation || "",
          missing_fact_keys: statusMap[c.key]?.missing_fact_keys || []
        })));
        setPendingQuestions(data.questions || []);
      }
    } catch (e) {
      toast({ title: "עדכון התוכנית נכשל", description: e.message, variant: "destructive" });
    }
    setRecalcLoading(false);
    setRecalcDone(true);
  };

  // Initial discovery + first recalc.
  useEffect(() => {
    (async () => {
      if (policies.length > 0 && healthEvent && !discovering && items.length === 0 && !recalcDone) {
        const its = await runDiscovery();
        setDiscovering(false);
        if (its && its.length > 0) {
          await runRecalc(its, []);
        } else {
          setRecalcDone(true);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies, healthEvent]);

  const currentQuestion = editIndex != null ? answeredFacts[editIndex] : pendingQuestions[0];
  const answeredCount = answeredFacts.length;
  const remaining = pendingQuestions.length;
  const total = answeredCount + remaining;
  const coveragesReviewed = items.filter((it) => it.status && it.status !== "unknown").length;
  const allReviewed = recalcDone && items.length > 0 && pendingQuestions.length === 0 && editIndex == null;

  const handleContinue = async (answer) => {
    let newAnswered;
    if (editIndex != null) {
      const idx = editIndex;
      newAnswered = answeredFacts.slice(0, idx + 1);
      newAnswered[idx] = { ...answeredFacts[idx], value: answer };
      setAnsweredFacts(newAnswered);
      setEditIndex(null);
    } else {
      const q = pendingQuestions[0];
      if (!q) return;
      newAnswered = [...answeredFacts, {
        fact_key: q.fact_key,
        value: answer,
        prompt: q.prompt,
        answer_type: q.answer_type,
        options: q.options
      }];
      setAnsweredFacts(newAnswered);
    }
    await persistFacts(newAnswered);
    await runRecalc(items, newAnswered);
  };

  const handleBack = () => {
    if (recalcLoading) return;
    if (editIndex != null) {
      setEditIndex((i) => Math.max(0, i - 1));
    } else if (answeredFacts.length > 0) {
      setEditIndex(answeredFacts.length - 1);
    }
  };

  const preparePackage = async (insurer) => {
    setCreatingInsurer(insurer);
    try {
      const potentialItems = items.filter(
        (it) => (it.insurer || "חברת ביטוח") === insurer && it.status === "potential"
      );
      if (potentialItems.length === 0) return;

      const userAnswers = answeredFacts.map((f) => ({ question: f.prompt, answer: f.value }));

      const coverages = potentialItems.map((it) => ({
        name: it.coverage_name,
        benefit: it.benefit || "",
        conditions: it.conditions || "",
        source_clause: it.source_clause,
        source_page: it.source_page,
        source_text: it.source_text,
        policy_requirements: it.policy_requirements,
        relevance_reason: it.relevance_reason,
        eligibility_summary: it.explanation || "",
        user_answers: userAnswers
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

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12 min-w-0">
        {discovering || (recalcLoading && !recalcDone) ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin ml-2" /> בודקים אילו כיסויים עשויים להיות רלוונטיים…
          </div>
        ) : items.length === 0 && recalcDone ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground mb-4">לא מצאנו כיסויים שעשויים להיות רלוונטיים למקרה שתיארת.</p>
            <Button variant="outline" onClick={() => navigate("/policies")}>חזרה לפוליסות</Button>
          </div>
        ) : allReviewed ? (
          <FinalSummary
            items={items}
            answeredCount={answeredCount}
            onPreparePackage={preparePackage}
            packageStatus={packageStatus}
            onShowSource={(it) => setSourceModal(it)}
            creatingInsurer={creatingInsurer}
          />
        ) : currentQuestion ? (
          <GlobalQuestionFlow
            question={currentQuestion}
            initialValue={editIndex != null ? answeredFacts[editIndex]?.value : ""}
            editMode={editIndex != null}
            progress={{
              coveragesTotal: items.length,
              coveragesReviewed,
              answered: answeredCount,
              total,
              remaining
            }}
            onContinue={handleContinue}
            onBack={handleBack}
            canBack={editIndex != null || answeredFacts.length > 0}
            loading={recalcLoading}
          />
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin ml-2" /> מעדכן את תוכנית הבדיקה…
          </div>
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