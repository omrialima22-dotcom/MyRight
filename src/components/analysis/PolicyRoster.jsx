import React from "react";
import { CheckCircle2, Circle, Loader2, AlertTriangle } from "lucide-react";
import { policyDisplayLabel, policyStepState } from "@/lib/analysis";

export default function PolicyRoster({ policies }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-soft">
      <p className="text-sm font-medium text-muted-foreground mb-3">
        {policies.length} פוליסות בבדיקה
      </p>
      <div className="space-y-2.5">
        {policies.map((p, i) => {
          const st = policyStepState(p);
          const label = policyDisplayLabel(p, i);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3">
              <span className="text-[15px] truncate">{label}</span>
              {st === "done" ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> הסתיימה הקריאה
                </span>
              ) : st === "failed" ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" /> לא ניתן לקריאה
                </span>
              ) : st === "active" ? (
                <span className="flex items-center gap-1.5 text-xs text-accent shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" /> בבדיקה
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Circle className="w-4 h-4 text-muted-foreground/30" /> ממתינה
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}