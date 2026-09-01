import React from "react";

export default function ProgressHeader({ label, fillPercent }) {
  const pct = Math.max(8, Math.min(100, fillPercent));
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground">{label || "בוא נבין יחד מה קרה"}</p>
        <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}