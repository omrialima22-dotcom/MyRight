import React from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GeneralProgress({ steps }) {
  const hasPending = steps.some((s) => s.state === "pending");
  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-soft">
      <div className="space-y-3">
        {steps.map((s) => (
          <div key={s.key} className="flex items-center gap-3">
            {s.state === "done" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : s.state === "active" ? (
              <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground/30 shrink-0" />
            )}
            <span
              className={cn(
                "text-[15px]",
                s.state === "pending" ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
      {hasPending && (
        <p className="text-xs text-muted-foreground mt-4">
          השלבים הבאים יתבצעו לאחר סיום הקריאה, בהמשך התהליך.
        </p>
      )}
    </div>
  );
}