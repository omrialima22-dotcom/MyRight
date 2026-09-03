import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Loader2, CheckCircle2, Circle, FileText, Stethoscope, Send, Sparkles, Copy, ShieldCheck } from "lucide-react";
import { claimStatusLabels, claimStatusColors, formatDate, policyTypeLabels } from "@/lib/hebrew";
import { useToast } from "@/components/ui/use-toast";

export default function ClaimDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [claim, setClaim] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [editingLetter, setEditingLetter] = useState(null);
  const [letterDraft, setLetterDraft] = useState("");

  const isPackage = Array.isArray(claim?.coverages) && claim.coverages.length > 0;

  const load = async () => {
    setLoading(true);
    try {
      const c = await base44.entities.Claim.get(id);
      setClaim(c);
      if (c.policy_id) {
        try {
          const p = await base44.entities.Policy.get(c.policy_id);
          setPolicy(p);
        } catch (e) {}
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const toggleItem = async (index) => {
    const newChecklist = claim.checklist.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
    setClaim({ ...claim, checklist: newChecklist });
    try {
      await base44.entities.Claim.update(id, { checklist: newChecklist });
    } catch (e) {
      toast({ title: "שגיאה בעדכון", variant: "destructive" });
      load();
    }
  };

  const letterContext = () => {
    if (isPackage) {
      const names = claim.coverages.map((c) => c.name).filter(Boolean);
      const clauses = claim.coverages.map((c) => c.source_clause).filter(Boolean);
      return {
        coverage_name: names.join(", "),
        coverage_conditions: claim.coverages.map((c) => c.conditions || "").filter(Boolean).join("\n"),
        source_clause: clauses.join(", "),
        source_page: claim.coverages[0]?.source_page ?? null,
        policy_requirements: claim.coverages.map((c) => c.policy_requirements).filter(Boolean).join("\n"),
        user_answers: claim.coverages.flatMap((c) => c.user_answers || []),
        eligibility_summary: claim.coverages.map((c) => c.eligibility_summary).filter(Boolean).join("\n")
      };
    }
    return {
      coverage_name: claim.coverage_name,
      coverage_conditions: policy?.coverages?.find((c) => (c.sourceClause || "") === (claim.source_clause || ""))?.conditions || "",
      source_clause: claim.source_clause,
      source_page: claim.source_page,
      policy_requirements: "",
      user_answers: claim.user_answers,
      eligibility_summary: claim.eligibility_summary
    };
  };

  const generateLetter = async (type) => {
    setGenerating(type);
    try {
      const res = await base44.functions.invoke("generateLetter", {
        type,
        claim_title: claim.title,
        claim_description: claim.description,
        insurance_company: claim.insurer || policy?.insurance_company,
        policy_number: policy?.policy_number,
        incident_date: claim.incident_date ? formatDate(claim.incident_date) : null,
        user_name: user?.full_name,
        ...letterContext()
      });
      const content = res.data.content;
      const field = type === "doctor" ? "doctor_letter" : "claim_letter";
      await base44.entities.Claim.update(id, { [field]: content });
      setClaim((c) => ({ ...c, [field]: content }));
      toast({ title: type === "doctor" ? "מכתב הרופא מוכן" : "מכתב התביעה מוכן" });
    } catch (e) {
      toast({ title: "יצירת המכתב נכשלה", variant: "destructive" });
    }
    setGenerating(null);
  };

  const saveLetter = async (field) => {
    try {
      await base44.entities.Claim.update(id, { [field]: letterDraft });
      setClaim((c) => ({ ...c, [field]: letterDraft }));
      setEditingLetter(null);
      toast({ title: "המכתב נשמר" });
    } catch (e) {
      toast({ title: "שמירה נכשלה", variant: "destructive" });
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: "הועתק ללוח" });
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

  if (!claim) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-5 py-12 text-center">
          <p className="text-muted-foreground">התביעה לא נמצאה.</p>
          <Link to="/claims" className="text-primary hover:underline mt-2 inline-block">חזרה לתביעות</Link>
        </div>
      </Layout>
    );
  }

  const checklist = claim.checklist || [];
  const doneCount = checklist.filter((i) => i.done).length;
  const total = checklist.length;
  const remaining = checklist.filter((i) => !i.done);

  // Group checklist items.
  const groups = [];
  const groupMap = {};
  checklist.forEach((item, i) => {
    const g = item.group || "shared";
    if (!groupMap[g]) {
      groupMap[g] = [];
      groups.push(g);
    }
    groupMap[g].push({ ...item, _i: i });
  });
  const orderedGroups = ["shared", ...groups.filter((g) => g !== "shared")];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-8 lg:py-12 min-w-0">
        <Link to="/claims" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-5">
          <ArrowRight className="w-4 h-4" /> חזרה לתביעות
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl lg:text-3xl font-bold mb-1 break-words">{claim.title}</h1>
            <p className="text-muted-foreground text-sm">
              {claim.insurer || (policy && policy.insurance_company)}
              {policy && <span> · {policyTypeLabels[policy.policy_type]}</span>}
            </p>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${claimStatusColors[claim.status] || ""}`}>
            {claimStatusLabels[claim.status] || claim.status}
          </span>
        </div>

        {/* Package: included benefits */}
        {isPackage && (
          <div className="bg-tint-mint rounded-2xl border border-border p-5 mb-6">
            <h3 className="text-sm font-medium text-accent mb-3">התביעה כוללת {claim.coverages.length} זכויות אפשריות</h3>
            <div className="space-y-2">
              {claim.coverages.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium break-words">{c.name}</p>
                    {c.eligibility_summary && (
                      <p className="text-sm text-foreground/80 leading-relaxed break-words">{c.eligibility_summary}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single-coverage eligibility summary */}
        {!isPackage && claim.eligibility_summary && (
          <div className="bg-tint-mint rounded-2xl border border-border p-5 mb-6">
            <h3 className="text-sm font-medium text-accent mb-2">סיכום הזכאות האפשרית</h3>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{claim.eligibility_summary}</p>
            {claim.coverage_name && (
              <p className="text-xs text-muted-foreground mt-2">כיסוי: {claim.coverage_name}{claim.source_clause ? ` · סעיף ${claim.source_clause}` : ""}</p>
            )}
          </div>
        )}

        {/* Description */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">תיאור המקרה</h3>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{claim.description}</p>
        </div>

        {/* Checklist */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <h2 className="font-heading text-lg font-semibold">{isPackage ? "חבילת התביעה שלך" : "הצ׳קליסט שלי"}</h2>
            </div>
            {total > 0 && (
              <span className="text-sm text-muted-foreground">{doneCount} מתוך {total} פריטים מוכנים</span>
            )}
          </div>

          {total > 0 ? (
            <>
              {total > 0 && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
                </div>
              )}
              <div className="space-y-4">
                {isPackage ? (
                  orderedGroups.map((g) => (
                    <div key={g}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        {g === "shared" ? "מסמכים משותפים" : g}
                      </p>
                      <div className="space-y-1">
                        {groupMap[g].map((item) => (
                          <ChecklistRow key={item._i} item={item} onToggle={() => toggleItem(item._i)} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="space-y-1">
                    {checklist.map((item, i) => (
                      <ChecklistRow key={i} item={item} onToggle={() => toggleItem(i)} />
                    ))}
                  </div>
                )}
              </div>

              {remaining.length > 0 && (
                <div className="mt-5 bg-muted/40 rounded-xl p-4">
                  <p className="text-sm font-medium mb-2">נשארו לך {remaining.length} פעולות</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pr-4">
                    {remaining.map((item, i) => (
                      <li key={i} className="break-words">{item.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">אין פריטים בצ׳קליסט עדיין.</p>
          )}
        </div>

        {/* Letters */}
        <div className="grid sm:grid-cols-2 gap-4">
          <LetterCard
            title="מסמך לרופא"
            icon={Stethoscope}
            content={claim.doctor_letter}
            generating={generating === "doctor"}
            onGenerate={() => generateLetter("doctor")}
            editing={editingLetter === "doctor_letter"}
            draft={letterDraft}
            setDraft={setLetterDraft}
            onEdit={() => { setEditingLetter("doctor_letter"); setLetterDraft(claim.doctor_letter || ""); }}
            onSave={() => saveLetter("doctor_letter")}
            onCancel={() => setEditingLetter(null)}
            onCopy={() => copyText(claim.doctor_letter)}
          />
          <LetterCard
            title="מכתב תביעה לחברת הביטוח"
            icon={FileText}
            content={claim.claim_letter}
            generating={generating === "insurance"}
            onGenerate={() => generateLetter("insurance")}
            editing={editingLetter === "claim_letter"}
            draft={letterDraft}
            setDraft={setLetterDraft}
            onEdit={() => { setEditingLetter("claim_letter"); setLetterDraft(claim.claim_letter || ""); }}
            onSave={() => saveLetter("claim_letter")}
            onCancel={() => setEditingLetter(null)}
            onCopy={() => copyText(claim.claim_letter)}
          />
        </div>
      </div>
    </Layout>
  );
}

function ChecklistRow({ item, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors text-right"
    >
      {item.done ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] leading-relaxed break-words ${item.done ? "line-through text-muted-foreground" : ""}`}>
          {item.text}
        </span>
        {item.category && (
          <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full ${item.category === "required" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {item.category === "required" ? "נדרש לפי הפוליסה" : "מומלץ לחיזוק התביעה"}
          </span>
        )}
      </span>
    </button>
  );
}

function LetterCard({ title, icon: Icon, content, generating, onGenerate, editing, draft, setDraft, onEdit, onSave, onCancel, onCopy }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-heading font-semibold">{title}</h3>
      </div>

      {generating ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin ml-2" /> כותב את המכתב…
        </div>
      ) : editing ? (
        <div className="flex-1 flex flex-col">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} className="flex-1 text-[15px] leading-relaxed" />
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={onSave}>שמירה</Button>
            <Button size="sm" variant="outline" onClick={onCancel}>ביטול</Button>
          </div>
        </div>
      ) : content ? (
        <div className="flex-1 flex flex-col">
          <div className="bg-muted/40 rounded-xl p-4 max-h-64 overflow-y-auto scrollbar-thin flex-1">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={onCopy}><Copy className="w-3.5 h-3.5 ml-1.5" /> העתקה</Button>
            <Button size="sm" variant="outline" onClick={onEdit}>עריכה</Button>
            <Button size="sm" variant="outline" onClick={onGenerate}><Sparkles className="w-3.5 h-3.5 ml-1.5" /> יצירה מחדש</Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <p className="text-sm text-muted-foreground mb-4">אין מכתב עדיין. ניתן ליצור אחד בעברית מוכן לשליחה.</p>
          <Button size="sm" onClick={onGenerate}>
            <Send className="w-3.5 h-3.5 ml-1.5" /> יצירת המכתב
          </Button>
        </div>
      )}
    </div>
  );
}