import React, { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import InsurerCard from "@/components/eligibility/InsurerCard";
import PendingChecksCard from "@/components/eligibility/PendingChecksCard";

export default function FinalSummary({ items, answeredCount, onPreparePackage, packageStatus, onShowSource, creatingInsurer }) {
  const [showAll, setShowAll] = useState(false);

  const checkedCount = items.length;
  const potential = items.filter((it) => it.status === "potential");
  const notRelevant = items.filter((it) => it.status === "not_relevant");
  const missingInfo = items.filter((it) => it.status === "unknown");

  const insurers = Array.from(new Set(potential.map((it) => it.insurer || "חברת ביטוח")));
  const byInsurer = (name) => potential.filter((it) => (it.insurer || "חברת ביטוח") === name);

  const indirectCount = potential.filter((it) => it.relevance === "indirect").length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-tint-mint mb-4">
          <CheckCircle2 className="w-8 h-8 text-accent" />
        </div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold mb-2">סיימנו את הבדיקה</h1>
        <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
          ענית על <span className="font-semibold text-foreground">{answeredCount}</span> שאלות.
        </p>
        <p className="text-muted-foreground leading-relaxed max-w-md mx-auto mt-1">
          באמצעות התשובות שלך בדקנו <span className="font-semibold text-foreground">{checkedCount}</span> דברים שמצאנו בפוליסות שלך.
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
        <p className="text-center text-sm text-muted-foreground mb-1">מצאנו</p>
        <p className="text-center font-heading text-2xl font-bold text-accent mb-1">
          {potential.length} {potential.length === 1 ? "זכות אפשרית אחת" : "זכויות אפשריות"}
        </p>
        <p className="text-center text-sm text-muted-foreground">שכדאי להתקדם איתן</p>
        {indirectCount > 0 && (
          <p className="text-center text-sm text-accent mt-2 leading-relaxed">
            מתוכן {indirectCount} שעלו בעקבות ההשלכות של מה שתיארת — לא מהתיאור עצמו
          </p>
        )}
      </div>

      {potential.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            {missingInfo.length > 0
              ? "עדיין לא סגרנו אף כיסוי — חסרים פרטים בכיסויים שלמטה. זה לא אומר שלא מגיע לך."
              : "לפי המידע שמסרת, לא מצאנו כיסויים שעשויים להיות רלוונטיים כרגע."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground text-center">עכשיו נעשה סדר לפי חברת הביטוח</p>
          <div className="space-y-3">
            {insurers.map((name) => (
              <InsurerCard
                key={name}
                insurer={name}
                items={byInsurer(name)}
                packageStatus={packageStatus}
                onPreparePackage={() => onPreparePackage(name)}
                onShowSource={onShowSource}
                creating={creatingInsurer === name}
              />
            ))}
          </div>
        </>
      )}

      {/* Coverages that are still open — shown, never hidden */}
      <PendingChecksCard items={missingInfo} onShowSource={onShowSource} />

      {/* Additional checks */}
      {notRelevant.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="font-medium">דברים נוספים שבדקנו</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {!showAll && (
            <div className="mt-3 text-sm text-muted-foreground space-y-1">
              <p>{notRelevant.length} כיסויים — כנראה לא רלוונטיים לפי המידע שנמסר</p>
            </div>
          )}
          {showAll && (
            <div className="mt-3 space-y-2 animate-fade-up">
              {notRelevant.map((it) => (
                <div key={it.key} className="text-sm border border-border rounded-xl p-3">
                  <p className="font-medium text-foreground/90 break-words">{it.coverage_name}</p>
                  <p className="mt-1 text-muted-foreground break-words">
                    {it.explanation || "כנראה לא רלוונטי"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}