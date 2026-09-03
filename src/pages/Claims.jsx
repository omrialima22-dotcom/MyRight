import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Layout from "@/components/Layout";
import AddClaimDialog from "@/components/AddClaimDialog";
import { Plus, FolderKanban, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { claimStatusLabels, claimStatusColors, formatDate } from "@/lib/hebrew";

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        base44.entities.Claim.list("-created_date", 100),
        base44.entities.Policy.list("-created_date", 100)
      ]);
      setClaims(c);
      setPolicies(p);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl lg:text-3xl font-bold mb-1">התביעות שלי</h1>
            <p className="text-muted-foreground">תביעות בהכנה, עם צ׳קליסט ומכתבים מוכנים לשליחה</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> פתיחת תביעה
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin ml-2" /> טוען…
          </div>
        ) : claims.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <FolderKanban className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold mb-2">אין תביעות עדיין</h3>
            <p className="text-muted-foreground mb-5 max-w-md mx-auto">פתח תביעה חדשה, והעוזר שלנו יכין לך צ׳קליסט מסמכים ומכתבים מוכנים – כדי שתוכל להגיש בקלות.</p>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90">
              <Plus className="w-4 h-4" /> פתיחת תביעה ראשונה
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((c) => {
              const doneCount = (c.checklist || []).filter((i) => i.done).length;
              const total = (c.checklist || []).length;
              return (
                <Link
                  key={c.id}
                  to={`/claims/${c.id}`}
                  className="group block bg-card rounded-2xl border border-border p-5 hover:shadow-lg hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-heading font-semibold text-lg">{c.title}</h3>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${claimStatusColors[c.status] || ""}`}>
                      {claimStatusLabels[c.status] || c.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {c.incident_date && <span>אירוע: {formatDate(c.incident_date)}</span>}
                    {total > 0 && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {doneCount}/{total} בצ׳קליסט
                      </span>
                    )}
                    <span className="mr-auto flex items-center gap-1 text-primary group-hover:gap-2 transition-all">
                      פתיחה <ArrowLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <AddClaimDialog open={open} onOpenChange={setOpen} onAdded={load} policies={policies} />
    </Layout>
  );
}