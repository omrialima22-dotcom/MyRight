import React from "react";
import { ShieldCheck, ChevronLeft, Circle, CheckCircle2, FileText } from "lucide-react";

export default function CheckList({ items, states, onCheck, onShowSource }) {
  return (
    <div className="space-y-3">
      {items.map((it) => {
        const st = states[it.coverage_index] || {};
        return (
          <div key={it.coverage_index} className="bg-card rounded-2xl border border-border p-5 shadow-soft min-w-0 overflow-hidden">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-tint-warm flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-semibold text-lg break-words">{it.coverage_name}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed break-words">{it.relevance_reason}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
              <StatusBadge state={st} />
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => onShowSource(it)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 min-w-0">
                  <FileText className="w-4 h-4 shrink-0" /> <span className="truncate">מה כתוב בפוליסה?</span>
                </button>
                <button onClick={() => onCheck(it)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 shrink-0">
                  {st.match ? "המשך" : "בוא נבדוק"} <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ state }) {
  if (!state || (!state.answers?.length && !state.match && !state.claimId)) {
    const q = state?.questionsCount || 0;
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Circle className="w-3.5 h-3.5" /> {q ? `חסרות ${q} שאלות` : "מוכן לבדיקה"}
      </span>
    );
  }
  if (state.claimId) {
    return <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> תביעה בהכנה</span>;
  }
  if (state.match) {
    return <span className="text-xs text-accent">ייתכן שרלוונטי</span>;
  }
  return <span className="text-xs text-muted-foreground">התשובות נשמרו</span>;
}