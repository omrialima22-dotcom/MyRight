import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlobalQuestionFlow from "@/components/eligibility/GlobalQuestionFlow";
import IdentityStep from "@/components/eligibility/IdentityStep";
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
  const [identityPolicy, setIdentityPolicy] = useState(null);
  const [sourceModal, setSourceModal] = useState(null);
  const [requirements, setRequirements] = useState(null); // frozen requirement graph
  const [knownUserFacts, setKnownUserFacts] = useState([]);

  const policiesMap = React.useMemo(() => {
    const m = {};
    policies.forEach((p) => { m[p.id] = p; });
    return m;
  }, [policies]);

  const pastFacts = React.useMemo(
    () => (healthEvent?.facts || []).map((f) => ({ fact_key: f.fact_key, value: f.value })),
    [healthEvent]
  );

  const clauseLabel = (t) => ({
    schedule: "לוח תשלומים",
    definition: "הגדרה",
    waiting_period: "תקופת המתנה",
    exclusion: "חריג",
    condition: "תנאי זכאות",
    other: "נוסח מקורי"
  }[t] || "נוסח מקורי");

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

  // dropKeys = answers that were discarded when the user went back and changed an
  // earlier answer. They must disappear from the fact base too, otherwise the
  // engine keeps computing with answers the user no longer sees.
  const factsForRecalc = (currentAnswered, dropKeys = []) => {
    const map = {};
    pastFacts.forEach((f) => { map[f.fact_key] = f.value; });
    knownUserFacts.forEach((f) => { map[f.fact_key] = f.value; });
    dropKeys.forEach((k) => { delete map[k]; });
    currentAnswered.forEach((f) => { map[f.fact_key] = f.value; });
    return Object.keys(map).map((k) => ({ fact_key: k, value: map[k] }));
  };

  const persistFacts = async (currentAnswered, dropKeys = []) => {
    if (!healthEvent?.id) return;
    const map = {};
    pastFacts.forEach((f) => { map[f.fact_key] = f.value; });
    dropKeys.forEach((k) => { delete map[k]; });
    currentAnswered.forEach((f) => { map[f.fact_key] = f.value; });
    const facts = Object.keys(map).map((k) => ({
      fact_key: k, value: map[k], certainty: "confirmed", source: "user"
    }));
    try {
      await base44.entities.HealthEvent.update(healthEvent.id, { facts });
      setHealthEvent((prev) => (prev ? { ...prev, facts } : prev));
    } catch {}
  };

  const runRecalc = async (coverages, currentAnswered, reqOverride, dropKeys = []) => {
    setRecalcLoading(true);
    try {
      const activeRequirements = reqOverride !== undefined ? reqOverride : requirements;
      const isFreezeCall = !activeRequirements;
      const payload = activeRequirements
        ? { requirements: activeRequirements, facts: factsForRecalc(currentAnswered, dropKeys) }
        : {
            coverages,
            facts: factsForRecalc(currentAnswered, dropKeys),
            event_summary: healthEvent?.summary || "",
            event_story: healthEvent?.story || "",
            event_answers: healthEvent?.answers || []
          };
      const res = await base44.functions.invoke("recalcReviewPlan", payload);
      const data = res.data || res;
      if (data.error) {
        toast({ title: "עדכון התוכנית נכשל", description: data.error, variant: "destructive" });
      } else {
        if (data.requirements) {
          setRequirements(data.requirements);
          if (isFreezeCall && healthEvent?.id) {
            try {
              await base44.entities.HealthEvent.update(healthEvent.id, {
                frozen_requirements: data.requirements,
                frozen_items: coverages
              });
            } catch {}
          }
        }
        if (data.known_user_facts) setKnownUserFacts(data.known_user_facts);
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

  // Identity gate → discovery → first recalc.
  useEffect(() => {
    (async () => {
      if (loading || policies.length === 0 || !healthEvent) return;
      const needIdentity = policies.filter((p) => {
        const people = Array.isArray(p.insured_people) ? p.insured_people : [];
        return people.length > 1 && !p.confirmed_insured_role;
      });
      if (needIdentity.length > 0) {
        // Invalidate any stale user-specific results produced before identity was confirmed.
        if (items.length > 0 || pendingQuestions.length > 0 || recalcDone) {
          setItems([]);
          setPendingQuestions([]);
          setAnsweredFacts([]);
          setRequirements(null);
          setKnownUserFacts([]);
          setRecalcDone(false);
        }
        setIdentityPolicy(needIdentity[0]);
        return;
      }
      if (discovering || recalcDone || items.length > 0) return;
      setIdentityPolicy(null);

      if (
        Array.isArray(healthEvent.frozen_requirements) && healthEvent.frozen_requirements.length > 0 &&
        Array.isArray(healthEvent.frozen_items) && healthEvent.frozen_items.length > 0
      ) {
        setRequirements(healthEvent.frozen_requirements);
        await runRecalc(healthEvent.frozen_items, [], healthEvent.frozen_requirements);
        return;
      }

      const its = await runDiscovery();
      setDiscovering(false);
      if (its && its.length > 0) {
        await runRecalc(its, []);
      } else {
        setRecalcDone(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies, healthEvent, loading]);

  const currentQuestion = editIndex != null ? answeredFacts[editIndex] : pendingQuestions[0];
  const answeredCount = answeredFacts.length;
  const remaining = pendingQuestions.length;
  const total = answeredCount + remaining;
  const coveragesReviewed = items.filter((it) => it.status && it.status !== "unknown").length;
  const allReviewed = recalcDone && items.length > 0 && pendingQuestions.length === 0 && editIndex == null;

  const handleContinue = async (answer) => {
    let newAnswered;
    let dropKeys = [];
    if (editIndex != null) {
      const idx = editIndex;
      dropKeys = answeredFacts.slice(idx + 1).map((f) => f.fact_key);
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
    await persistFacts(newAnswered, dropKeys);
    await runRecalc(items, newAnswered, undefined, dropKeys);
  };

  const handleBack = () => {
    if (recalcLoading) return;
    if (editIndex != null) {
      setEditIndex((i) => Math.max(0, i - 1));
    } else if (answeredFacts.length > 0) {
      setEditIndex(answeredFacts.length - 1);
    }
  };

  const confirmIdentity = async (role, name) => {
    if (!identityPolicy) return;
    const updated = {
      confirmed_insured_role: role,
      confirmed_insured_name: name || '',
      confirmed_at: new Date().toISOString()
    };
    try {
      await base44.entities.Policy.update(identityPolicy.id, updated);
      setPolicies((prev) => prev.map((p) => (p.id === identityPolicy.id ? { ...p, ...updated } : p)));
    } catch (e) {
      toast({ title: "שמירת הזיהוי נכשלה", description: e.message, variant: "destructive" });
    }
    // Fresh rebuild: discard any prior person-specific results so discovery + recalc run clean.
    setItems([]);
    setPendingQuestions([]);
    setAnsweredFacts([]);
    setRequirements(null);
    setKnownUserFacts([]);
    setRecalcDone(false);
    setIdentityPolicy(null);
  };

  const changeIdentity = async (policyId) => {
    try {
      await base44.entities.Policy.update(policyId, {
        confirmed_insured_role: null,
        confirmed_insured_name: null,
        confirmed_at: null
      });
      setPolicies((prev) => prev.map((p) => (p.id === policyId ? { ...p, confirmed_insured_role: null, confirmed_insured_name: null, confirmed_at: null } : p)));
    } catch (e) {
      toast({ title: "שגיאה בשינוי המבוטח", description: e.message, variant: "destructive" });
      return;
    }
    setItems([]);
    setPendingQuestions([]);
    setAnsweredFacts([]);
    setRequirements(null);
    setKnownUserFacts([]);
    setRecalcDone(false);
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
        ) : identityPolicy ? (
          <IdentityStep policy={identityPolicy} onConfirm={confirmIdentity} />
        ) : items.length === 0 && recalcDone ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground mb-4">לא מצאנו כיסויים שעשויים להיות רלוונטיים למקרה שתיארת.</p>
            <Button variant="outline" onClick={() => navigate("/policies")}>חזרה לפוליסות</Button>
          </div>
        ) : allReviewed ? (
          <div>
            {policies.some((p) => (Array.isArray(p.insured_people) ? p.insured_people.length : 0) > 1) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {policies.filter((p) => (Array.isArray(p.insured_people) ? p.insured_people.length : 0) > 1).map((p) => (
                  <Button key={p.id} variant="outline" size="sm" onClick={() => changeIdentity(p.id)}>
                    שינוי מבוטח — {p.insurance_company || "פוליסה"}
                  </Button>
                ))}
              </div>
            )}
            <FinalSummary
              items={items}
              answeredCount={answeredCount}
              onPreparePackage={preparePackage}
              packageStatus={packageStatus}
              onShowSource={(it) => setSourceModal(it)}
              creatingInsurer={creatingInsurer}
            />
          </div>
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
            {sourceModal.person_role && (
              <p className="text-sm text-muted-foreground mb-2">עמודה בפוליסה: {sourceModal.person_role}</p>
            )}
            {sourceModal.source_clause && (
              <p className="text-sm text-muted-foreground mb-2">
                סעיף {sourceModal.source_clause}{sourceModal.source_page != null ? ` · עמוד ${sourceModal.source_page}` : ""}
              </p>
            )}
            {sourceModal.clauses && sourceModal.clauses.length > 0 ? (
              <div className="space-y-2">
                {sourceModal.clauses.map((cl, i) => (
                  <div key={i} className="text-sm border-r-2 border-accent/40 pr-3">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {clauseLabel(cl.type)}{cl.page != null ? ` · עמוד ${cl.page}` : ""}{cl.clause ? ` · סעיף ${cl.clause}` : ""}
                    </p>
                    <p className="leading-relaxed whitespace-pre-wrap break-words text-foreground/90">{cl.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
                {sourceModal.source_text || "לא שמרנו את הנוסח המקורי."}
              </p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}