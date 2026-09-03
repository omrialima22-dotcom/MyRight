import React, { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const KIND_TINT = {
  insurer: "bg-tint-blue",
  type: "bg-tint-mint",
  coverage: "bg-tint-warm",
  waiting: "bg-tint-peach",
  condition: "bg-tint-pink",
  period: "bg-tint-green"
};

export default function DiscoveryCard({ discovery }) {
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setFresh(false), 1800);
    return () => clearTimeout(t);
  }, []);

  const tint = KIND_TINT[discovery.kind] || "bg-muted";
  const source = discovery.source;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border p-4 shadow-soft transition-all animate-fade-up",
        tint,
        fresh ? "ring-2 ring-accent/30" : ""
      )}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground mb-0.5">{discovery.label}</p>
          <p className="text-[15px] font-semibold leading-snug break-words">
            {discovery.value}
          </p>
          {discovery.sub && (
            <p className="text-sm text-foreground/80 mt-1 break-words">{discovery.sub}</p>
          )}
          {source && source.page != null && (
            <p className="text-xs text-muted-foreground mt-1.5">נמצא בעמוד {source.page}</p>
          )}
        </div>
      </div>
    </div>
  );
}