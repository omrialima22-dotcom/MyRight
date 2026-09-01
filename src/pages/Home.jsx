import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Layout from "@/components/Layout";
import { MessageCircle, ShieldCheck, FolderKanban, Plus, ArrowLeft, Sparkles, FileText } from "lucide-react";
import { claimStatusLabels, claimStatusColors, policyTypeLabels, formatDate } from "@/lib/hebrew";

export default function Home() {
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([
          base44.entities.Policy.list("-created_date", 50),
          base44.entities.Claim.list("-created_date", 50)
        ]);
        setPolicies(p);
        setClaims(c);
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const activeClaims = claims.filter((c) => c.status === "preparing" || c.status === "submitted").length;


  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            עוזר הביטוח האישי שלך
          </div>
          <h1 className="text-3xl lg:text-[2.6rem] font-heading font-bold mb-3 leading-tight">
            הזכות שלך, <span className="text-primary">ברורה ופשוטה</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            לא צריך לדעת ביטוח כדי לדעת מה מגיע לך. ספרו לנו מה קרה, ונזהה יחד אילו זכויות עשויות להיות רלוונטיות — בלי מונחים מסובכים ובלי לדעת מראש מה לתבוע.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-8">
          <StatCard label="פוליסות" value={loading ? "—" : policies.length} icon={ShieldCheck} />
          <StatCard label="תביעות פעילות" value={loading ? "—" : activeClaims} icon={FolderKanban} />
          <StatCard label="סה״כ תביעות" value={loading ? "—" : claims.length} icon={FileText} />
        </div>

        {/* Primary path */}
        <div className="mb-10">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-primary to-primary/85 text-white p-7 lg:p-10 shadow-lg">
            <div className="relative max-w-xl">
              <h2 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
                לא צריך לדעת ביטוח — רק לספר מה קרה
              </h2>
              <p className="text-white/85 text-base lg:text-lg leading-relaxed mb-6">
                נבנה יחד תמונה של מה שעברתם, נזהה אילו זכויות עשויות להיות רלוונטיות, ונכין את המסמכים. אתם רק עונים על שאלות פשוטות.
              </p>
              <Link
                to="/rights-check"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-primary font-semibold hover:bg-white/90 transition-colors"
              >
                בדיקת הזכויות שלי
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent claims */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-semibold">תביעות אחרונות</h2>
            <Link to="/claims" className="text-sm text-primary hover:underline flex items-center gap-1">
              כל התביעות <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          {loading ? (
            <div className="text-muted-foreground py-8 text-center">טוען…</div>
          ) : claims.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
              <FolderKanban className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">עדיין אין תביעות. ניתן לפתוח את התביעה הראשונה.</p>
              <Link to="/claims" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> פתיחת תביעה
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {claims.slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  to={`/claims/${c.id}`}
                  className="flex items-center justify-between bg-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(c.incident_date || c.created_date)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${claimStatusColors[c.status] || ""}`}>
                    {claimStatusLabels[c.status] || c.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 lg:p-5">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <p className="text-2xl lg:text-3xl font-heading font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}