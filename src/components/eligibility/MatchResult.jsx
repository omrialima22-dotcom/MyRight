import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertCircle, HelpCircle, Loader2 } from "lucide-react";

export default function MatchResult({ match, coverage, policy, onPrepareClaim, onBack, creating }) {
  if (!match) return null;

  // Missing info — never declare "not relevant".
  if (!match.potential_match && match.missing_info) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">חזרה לרשימה</button>
        <div className="bg-tint-warm rounded-2xl border border-border p-6 shadow-soft">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-background mb-3">
            <HelpCircle className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="font-heading font-bold text-xl mb-2">חסר לנו עוד מידע</h3>
          <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
            מצאנו התאמה אפשרית, אבל יש פרט נוסף שצריך לבדוק לפני שנוכל להתקדם.
          </p>
          <div className="bg-background/60 rounded-xl p-4 text-sm text-foreground/90 leading-relaxed border border-border mb-4 break-words">
            {match.missing_info}
          </div>
          <Button variant="outline" className="w-full" onClick={onBack}>חזרה לרשימה</Button>
        </div>
      </div>
    );
  }

  // No match and no missing info.
  if (!match.potential_match) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">חזרה לרשימה</button>
        <div className="bg-card rounded-2xl border border-border p-6 text-center shadow-soft">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold text-lg mb-1">כנראה שהכיסוי הזה לא רלוונטי</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">{match.explanation}</p>
        </div>
      </div>
    );
  }

  // Potential match.
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">חזרה לרשימה</button>
      <div className="bg-tint-mint rounded-2xl border border-border p-6 shadow-soft animate-fade-up">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-background mb-3">
          <Sparkles className="w-6 h-6 text-accent" />
        </div>
        <h3 className="font-heading font-bold text-xl mb-2">ייתכן שהכיסוי הזה רלוונטי אליך</h3>
        <p className="text-sm text-foreground/80 mb-4 leading-relaxed">
          לפי המידע שמסרת ותנאי הפוליסה, קיימת זכאות אפשרית שכדאי לבדוק.
        </p>
        <div className="bg-background/60 rounded-xl p-4 space-y-2 text-sm border border-border mb-4">
          <Row label="שם הכיסוי" value={coverage?.coverage_name} />
          {policy?.insurance_company && <Row label="חברת הביטוח" value={policy.insurance_company} />}
          {(match.benefit || coverage?.benefit) && <Row label="סכום / קצבה" value={match.benefit || coverage?.benefit} />}
          {coverage?.source_clause && <Row label="סעיף רלוונטי" value={coverage.source_clause} />}
        </div>
        <p className="text-sm text-foreground/90 mb-4 leading-relaxed break-words">{match.explanation}</p>
        {match.missing_info && (
          <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-800 mb-4 break-words">{match.missing_info}</div>
        )}
        <Button size="lg" className="w-full" onClick={onPrepareClaim} disabled={creating}>
          {creating ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מכין…</> : "בוא נכין את התביעה"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-left break-words">{value}</span>
    </div>
  );
}