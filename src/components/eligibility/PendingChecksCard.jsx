import React from "react";
import { AlertCircle, FileText } from "lucide-react";

export default function PendingChecksCard({ items, onShowSource }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-amber-200 p-5 shadow-soft min-w-0">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-tint-warm flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-700" />
        </div>
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-lg">כדאי לבדוק — חסר לנו פרט אחד</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            אלה כיסויים שעשויים להיות רלוונטיים, אבל חסר מידע כדי לדעת. זה לא אומר שלא מגיע לך.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.key} className="border border-border rounded-xl p-3 min-w-0">
            <p className="font-medium text-[15px] break-words">{it.coverage_name}</p>
            {it.insurer && <p className="text-xs text-muted-foreground mb-1">{it.insurer}</p>}
            {it.relevance === "indirect" && it.pathway && (
              <p className="text-xs text-accent mb-1 break-words">בעקבות: {it.pathway}</p>
            )}
            <p className="text-sm text-amber-800 leading-relaxed break-words">
              {it.explanation || "צריך להשלים פרט אחד כדי לדעת אם זה רלוונטי אליך."}
            </p>
            {it.relevance_reason && (
              <p className="text-sm text-foreground/70 leading-relaxed mt-1 break-words">{it.relevance_reason}</p>
            )}
            {it.source_text && (
              <button
                onClick={() => onShowSource(it)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> מה כתוב בפוליסה?
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}