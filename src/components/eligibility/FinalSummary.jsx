import React, { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import InsurerCard from "@/components/eligibility/InsurerCard";

export default function FinalSummary({ items, states, onPreparePackage, packageStatus, onShowSource, creatingInsurer }) {
  const [showAll, setShowAll] = useState(false);

  const checkedCount = items.length;
  const potential = items.filter((it) => states[it.key]?.match?.potential_match);
  const notRelevant = items.filter((it) => {
    const m = states[it.key]?.match;
    return m && !m.potential_match && !m.missing_info;
  });
  const missingInfo = items.filter((it) => {
    const m = states[it.key]?.match;
    return m && !m.potential_match && m.missing_info;
  });

  const insurers = Array.from(new Set(potential.map((it) => it.insurer || "חברת ביטוח")));
  const byInsurer = (name) => potential.filter((it) => (it.insurer || "חברת ביטוח") === name);

  const hasUnresolved = notRelevant.length > 0 || missingInfo.length > 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-tint-mint mb-4">
          <CheckCircle2 className="w-8 h-8 text-accent" />
        </div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold mb-2">סיימנו לבדוק הכול</h1>
        <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
          עברנו על כל הדברים שמצאנו בפוליסות והשווינו אותם למידע שמסרת.
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={checkedCount} label="אפשרויות נבדקו" />
          <Stat value={potential.length} label="זכויות אפשריות" accent />
          <Stat value={insurers.length} label="חברות ביטוח" />
        </div>
      </div>

      {potential.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">לפי המידע שמסרת, לא מצאנו כיסויים שעשויים להיות רלוונטיים כרגע.</p>
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
                states={states}
                packageStatus={packageStatus}
                onPreparePackage={() => onPreparePackage(name)}
                onShowSource={onShowSource}
                creating={creatingInsurer === name}
              />
            ))}
          </div>
        </>
      )}

      {/* Additional checks */}
      {hasUnresolved && (
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
              {notRelevant.length > 0 && <p>{notRelevant.length} כיסויים — כנראה לא רלוונטיים לפי המידע שנמסר</p>}
              {missingInfo.length > 0 && <p>{missingInfo.length} כיסוי — דורש מידע נוסף</p>}
            </div>
          )}
          {showAll && (
            <div className="mt-3 space-y-2 animate-fade-up">
              {[...notRelevant, ...missingInfo].map((it) => {
                const m = states[it.key]?.match;
                const isMissing = m && !m.potential_match && m.missing_info;
                return (
                  <div key={it.key} className="text-sm border border-border rounded-xl p-3">
                    <p className="font-medium text-foreground/90 break-words">{it.coverage_name}</p>
                    <p className={`mt-1 ${isMissing ? "text-amber-700" : "text-muted-foreground"}`}>
                      {isMissing ? "חסר מידע" : "כנראה לא רלוונטי"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, accent }) {
  return (
    <div>
      <p className={`font-heading text-2xl lg:text-3xl font-bold ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
    </div>
  );
}