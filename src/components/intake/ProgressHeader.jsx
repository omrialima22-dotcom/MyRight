import React from "react";

export default function ProgressHeader({ label, fillPercent }) {
  const pct = Math.max(6, Math.min(100, fillPercent));
  return (
    <div className="mb-10">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {label && (
        <p className="text-sm text-muted-foreground mt-3">{label}</p>
      )}
    </div>
  );
}