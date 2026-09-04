import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InsurerCard({ insurer, items, packageStatus, onPreparePackage, onShowSource, creating }) {
  const [open, setOpen] = useState(false);
  const packageId = packageStatus[insurer];

  const names = items.map((it) => it.coverage_name).filter(Boolean);
  const count = items.length;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-soft min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-xl break-words">{insurer || "חברת ביטוח"}</h3>
          <p className="text-sm text-accent font-medium mt-0.5">
            {count} {count === 1 ? "זכות אפשרית אחת" : "זכויות אפשריות"}
          </p>
        </div>
        <div className="w-11 h-11 rounded-2xl bg-tint-mint flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-accent" />
        </div>
      </div>

      <p className="text-sm text-foreground/80 leading-relaxed mb-1 break-words">{names.join(" · ")}</p>

      <button
        onClick={() => setOpen(!open)}
        className="mt-1 text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        למה זה עשוי להיות רלוונטי?
      </button>

      {open && (
        <div className="mt-3 space-y-3 animate-fade-up">
          {items.map((it) => (
            <BenefitDetail key={it.key} item={it} onShowSource={onShowSource} />
          ))}
        </div>
      )}

      <div className="mt-4">
        {packageId ? (
          <Button variant="outline" className="w-full" disabled>
            <CheckCircle2 className="w-4 h-4 ml-2" /> חבילת התביעה בתהליך
          </Button>
        ) : (
          <Button className="w-full" onClick={onPreparePackage} disabled={creating}>
            {creating ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מכין…</> : "הכנת חבילת תביעה"}
          </Button>
        )}
      </div>
    </div>
  );
}

function BenefitDetail({ item, onShowSource }) {
  const [showSource, setShowSource] = useState(false);
  return (
    <div className="bg-tint-mint/60 rounded-xl p-3 border border-border">
      <p className="font-medium text-[15px] mb-1 break-words">{item.coverage_name}</p>
      {item.relevance === "indirect" && item.pathway && (
        <p className="text-xs text-accent mb-1 break-words">עלה בעקבות: {item.pathway}</p>
      )}
      {item.person_role && item.benefit ? (
        <p className="text-sm font-semibold text-foreground mb-0.5 break-words">
          סכום הביטוח שלך: {item.benefit}
          <span className="text-muted-foreground font-normal"> ({item.person_role})</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground mb-0.5">סכום הביטוח האישי עדיין דורש אימות</p>
      )}
      {item.product_maximum && (
        <p className="text-xs text-muted-foreground mb-1 break-words">בפוליסה מופיעה תקרת מוצר של עד {item.product_maximum}</p>
      )}
      <p className="text-sm text-foreground/80 leading-relaxed break-words">
        {item.explanation || item.relevance_reason || "לפי המידע שמסרת ותנאי הפוליסה, ייתכן שכיסוי זה רלוונטי לתקופה שתיארת."}
      </p>
      {item.source_text && (
        <button onClick={() => onShowSource(item)} className="mt-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> מה כתוב בפוליסה?{item.source_clause ? ` · סעיף ${item.source_clause}` : ""}
        </button>
      )}
    </div>
  );
}