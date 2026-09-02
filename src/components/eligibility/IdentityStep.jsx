import React, { useState } from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IdentityStep({ policy, onConfirm }) {
  const people = Array.isArray(policy.insured_people) ? policy.insured_people : [];
  const [selected, setSelected] = useState(null);
  const namesMissing = people.every((p) => !p.fullName);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-tint-blue mb-4">
          <ShieldCheck className="w-7 h-7 text-accent" />
        </div>
        <h1 className="font-heading text-2xl font-bold mb-2">מצאנו כמה מבוטחים בפוליסה</h1>
        <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
          {policy.insurance_company ? `פוליסה של ${policy.insurance_company}. ` : ""}
          כדי לבדוק רק את הכיסויים ששייכים לך, צריך לדעת מי אתה בפוליסה.
        </p>
        {namesMissing && (
          <p className="text-xs text-muted-foreground/80 mt-2 max-w-md mx-auto leading-relaxed">
            לא הצלחנו לזהות בוודאות שמות — בחר לפי התווית שמופיעה במסמך.
          </p>
        )}
      </div>

      <div className="space-y-2.5">
        {people.map((p, i) => {
          const label = p.role || `מבוטח ${i + 1}`;
          const active = selected && selected.role === p.role;
          return (
            <button
              key={p.role || i}
              type="button"
              onClick={() => setSelected(p)}
              className={
                "w-full text-right px-5 py-4 rounded-2xl border text-[15px] font-medium transition-all flex items-center justify-between min-w-0 " +
                (active
                  ? "border-accent bg-accent text-accent-foreground shadow-soft"
                  : "border-border bg-background hover:bg-accent/10 hover:border-accent/40")
              }
            >
              <span className="min-w-0">
                <span className="block break-words">{label}</span>
                {p.fullName && (
                  <span className={"block text-sm break-words " + (active ? "text-accent-foreground/80" : "text-muted-foreground")}>
                    {p.fullName}
                  </span>
                )}
              </span>
              {active && <CheckCircle2 className="w-5 h-5 shrink-0" />}
            </button>
          );
        })}
      </div>

      <Button className="w-full" size="lg" disabled={!selected} onClick={() => onConfirm(selected.role, selected.fullName)}>
        אישור
      </Button>
    </div>
  );
}