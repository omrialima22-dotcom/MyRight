import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Layout from "@/components/Layout";
import HebrewMarkdown from "@/components/HebrewMarkdown";
import PolicyAnalysis from "@/components/policy/PolicyAnalysis";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { policyTypeLabels, formatCurrency, formatDate } from "@/lib/hebrew";
import { useToast } from "@/components/ui/use-toast";

export default function PolicyDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = await base44.entities.Policy.get(id);
      setPolicy(p);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  // Poll while the document is being read in the background.
  useEffect(() => {
    if (policy?.extraction_status !== "processing") return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      try {
        const p = await base44.entities.Policy.get(id);
        setPolicy(p);
        if (p.extraction_status !== "processing" || tries > 40) clearInterval(t);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [policy?.extraction_status, id]);

  const reanalyze = async () => {
    setAnalyzing(true);
    try {
      await base44.functions.invoke("analyzePolicy", { policy_id: id });
      await load();
      toast({ title: "התחלנו לקרוא את הפוליסה", description: "זה עשוי לקחת כמה רגעים" });
    } catch (e) {
      toast({ title: "הניתוח נכשל", variant: "destructive" });
    }
    setAnalyzing(false);
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

  if (!policy) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-5 py-12 text-center">
          <p className="text-muted-foreground">הפוליסה לא נמצאה.</p>
          <Link to="/policies" className="text-primary hover:underline mt-2 inline-block">חזרה לפוליסות</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-8 lg:py-12">
        <Link to="/policies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-5">
          <ArrowRight className="w-4 h-4" /> חזרה לפוליסות
        </Link>

        {/* Header card */}
        <div className="bg-gradient-to-bl from-primary to-primary/80 rounded-3xl p-6 lg:p-8 text-white mb-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-bold mb-1">{policy.insurance_company}</h1>
              <p className="text-white/80">{policyTypeLabels[policy.policy_type] || policy.policy_type}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/15">
            <DetailField label="מספר פוליסה" value={policy.policy_number || "—"} />
            <DetailField label="סכום כיסוי" value={formatCurrency(policy.coverage_amount)} />
            <DetailField label="פרמיה חודשית" value={formatCurrency(policy.monthly_premium)} />
            <DetailField label="תחילה" value={formatDate(policy.start_date)} />
          </div>
        </div>

        {policy.notes && (
          <div className="bg-card rounded-2xl border border-border p-5 mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-1.5">הערות</h3>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{policy.notes}</p>
          </div>
        )}

        {/* Analysis engine */}
        <PolicyAnalysis policy={policy} analyzing={analyzing} onRun={reanalyze} />
      </div>
    </Layout>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-white/60 mb-1">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}