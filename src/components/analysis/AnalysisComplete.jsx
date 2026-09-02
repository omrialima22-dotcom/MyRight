import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { countChecked, countCoverages, countFailed } from "@/lib/analysis";

export default function AnalysisComplete({ policies, onDone }) {
  const checked = countChecked(policies);
  const coverages = countCoverages(policies);
  const failed = countFailed(policies);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-soft text-center animate-fade-up">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-emerald-50 mb-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 className="font-heading text-xl sm:text-2xl font-bold mb-2">
        סיימנו לקרוא את הביטוחים שלך
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
        הנתונים שלהלן נלקחו ישירות מהמסמכים שהעלית.
      </p>
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <Stat label="פוליסות נבדקו" value={checked} />
        <Stat label="כיסויים זוהו" value={coverages} />
        {failed > 0 && <Stat label="דורשות תשומת לב" value={failed} tone="amber" />}
      </div>
      <Button size="lg" onClick={onDone}>בוא נראה מה מצאנו</Button>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div
      className={
        "rounded-2xl px-5 py-3 min-w-[110px] " +
        (tone === "amber" ? "bg-amber-50" : "bg-muted")
      }
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}