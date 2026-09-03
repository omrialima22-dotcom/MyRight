import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Layout from "@/components/Layout";
import AddPolicyDialog from "@/components/AddPolicyDialog";
import { Plus, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import { policyTypeLabels, formatCurrency, formatDate } from "@/lib/hebrew";

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = await base44.entities.Policy.list("-created_date", 100);
      setPolicies(p);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Silently refresh while any policy is still being read in the background.
  useEffect(() => {
    if (!policies.some((p) => p.extraction_status === "processing")) return;
    const t = setInterval(async () => {
      try { setPolicies(await base44.entities.Policy.list("-created_date", 100)); } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [policies]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl lg:text-3xl font-bold mb-1">הפוליסות שלי</h1>
            <p className="text-muted-foreground">כל הפוליסות שלך במקום אחד, עם הסבר ברור על כל אחת</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> הוספת פוליסה
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin ml-2" /> טוען…
          </div>
        ) : policies.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold mb-2">אין פוליסות עדיין</h3>
            <p className="text-muted-foreground mb-5 max-w-md mx-auto">הוסף את הפוליסה הראשונה שלך, והעוזר שלנו ינתח אותה ויסביר לך בעברית פשוטה מה מכוסה ומה חשוב לדעת.</p>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90">
              <Plus className="w-4 h-4" /> הוספת פוליסה ראשונה
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {policies.map((p) => (
              <Link
                key={p.id}
                to={`/policies/${p.id}`}
                className="group bg-card rounded-2xl border border-border p-5 hover:shadow-lg hover:border-primary/30 transition-all min-w-0 overflow-hidden break-words"
              >
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all shrink-0" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-1 break-words">{p.insurance_company}</h3>
                <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2 flex-wrap">
                  {policyTypeLabels[p.policy_type] || p.policy_type}
                  {p.extraction_status === "processing" && <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Loader2 className="w-3 h-3 animate-spin" /> בקריאה</span>}
                  {p.extraction_status === "unreadable" && <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">לא נקראה</span>}
                  {p.extraction_status === "failed" && <span className="text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">שגיאה</span>}
                  {p.extraction_status === "success" && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">נקראה</span>}
                </p>
                <div className="space-y-1.5 text-sm border-t border-border pt-3">
                  {p.coverage_amount != null && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">סכום כיסוי</span><span className="font-medium text-left break-words">{formatCurrency(p.coverage_amount)}</span></div>
                  )}
                  {p.monthly_premium != null && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">פרמיה חודשית</span><span className="font-medium text-left break-words">{formatCurrency(p.monthly_premium)}</span></div>
                  )}
                  {p.start_date && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">תחילה</span><span className="font-medium text-left break-words">{formatDate(p.start_date)}</span></div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AddPolicyDialog open={open} onOpenChange={setOpen} onAdded={load} />
    </Layout>
  );
}