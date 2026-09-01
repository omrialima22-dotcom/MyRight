import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Layout from "@/components/Layout";
import HebrewMarkdown from "@/components/HebrewMarkdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Loader2, CheckCircle2, Circle, FileText, Stethoscope, Send, Sparkles, Copy } from "lucide-react";
import { claimStatusLabels, claimStatusColors, formatDate, policyTypeLabels } from "@/lib/hebrew";
import { useToast } from "@/components/ui/use-toast";

export default function ClaimDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [claim, setClaim] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null); // "doctor" | "insurance"
  const [editingLetter, setEditingLetter] = useState(null);
  const [letterDraft, setLetterDraft] = useState("");

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

  const generateLetter = async (type) => {
    setGenerating(type);
    try {
      const res = await base44.functions.invoke("generateLetter", {
        type,
        claim_title: claim.title,
        claim_description: claim.description,
        insurance_company: policy?.insurance_company,
        policy_number: policy?.policy_number,
        incident_date: claim.incident_date ? formatDate(claim.incident_date) : null,
        user_name: user?.full_name
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

  const doneCount = (claim.checklist || []).filter((i) => i.done).length;
  const total = (claim.checklist || []).length;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-8 lg:py-12">
        <Link to="/claims" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-5">
          <ArrowRight className="w-4 h-4" /> חזרה לתביעות
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl lg:text-3xl font-bold mb-1">{claim.title}</h1>
            <p className="text-muted-foreground text-sm">
              {claim.incident_date && <span>אירוע: {formatDate(claim.incident_date)} · </span>}
              {policy && <span>{policy.insurance_company} – {policyTypeLabels[policy.policy_type]}</span>}
            </p>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${claimStatusColors[claim.status] || ""}`}>
            {claimStatusLabels[claim.status] || claim.status}
          </span>
        </div>

        {/* Description */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">תיאור המקרה</h3>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{claim.description}</p>
        </div>

        {/* Checklist */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <h2 className="font-heading text-lg font-semibold">הצ׳קליסט שלי</h2>
            </div>
            {total > 0 && (
              <span className="text-sm text-muted-foreground">{doneCount} מתוך {total} הושלמו</span>
            )}
          </div>
          {total > 0 ? (
            <div className="space-y-1">
              {claim.checklist.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleItem(i)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors text-right"
                >
                  {item.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  )}
                  <span className={`text-[15px] leading-relaxed ${item.done ? "line-through text-muted-foreground" : ""}`}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">אין פריטים בצ׳קליסט עדיין.</p>
          )}
        </div>

        {/* Letters */}
        <div className="grid sm:grid-cols-2 gap-4">
          <LetterCard
            title="מכתב לרופא"
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
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{content}</p>
          </div>
          <div className="flex gap-2 mt-3">
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