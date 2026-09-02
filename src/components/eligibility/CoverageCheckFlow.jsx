import React, { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CoverageCheckFlow({ item, initialAnswers = [], onSubmit, onBack, loading }) {
  const [showSource, setShowSource] = useState(false);
  const questions = item.questions || [];
  const [localAnswers, setLocalAnswers] = useState(() =>
    (initialAnswers || []).map((a) => ({ question: a.question, answer: a.answer }))
  );
  const [currentIdx, setCurrentIdx] = useState(0);

  if (questions.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-4 h-4" /> חזרה לרשימה
        </button>
        <CriteriaCard item={item} showSource={showSource} setShowSource={setShowSource} />
        <div className="bg-card rounded-2xl border border-border p-6 text-center shadow-soft">
          <p className="text-sm text-muted-foreground mb-4">אין שאלות נוספות לבדיקה. נבדוק את ההתאמה האפשרית מול תנאי הפוליסה.</p>
          <Button className="w-full" size="lg" onClick={() => onSubmit([])} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> בודקים…</> : "בוא נבדוק התאמה"}
          </Button>
        </div>
      </div>
    );
  }

  const total = questions.length;
  const current = questions[currentIdx];
  const isLast = currentIdx === total - 1;
  const selected = localAnswers[currentIdx]?.answer || "";
  const hasAnswer = !!selected;
  const isQuick = current.answer_type === "quick" && current.options?.length;
  const progressPct = Math.round(((currentIdx + 1) / total) * 100);

  const setAnswer = (answer) => {
    setLocalAnswers((prev) => {
      const next = [...prev];
      next[currentIdx] = { question: current.prompt, answer };
      return next;
    });
  };

  const handleContinue = () => {
    if (!hasAnswer || loading) return;
    if (isLast) {
      onSubmit(localAnswers.filter(Boolean));
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (loading) return;
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
    else onBack();
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> חזרה לרשימה
      </button>

      <CriteriaCard item={item} showSource={showSource} setShowSource={setShowSource} />

      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-soft">
        {/* Progress */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>שאלה {currentIdx + 1} מתוך {total}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div key={currentIdx} className="animate-fade-up">
          <p className="text-lg font-medium leading-relaxed mb-4 break-words">{current.prompt}</p>

          {isQuick ? (
            <div className="grid gap-2.5">
              {current.options.map((opt) => {
                const active = opt === selected;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={loading}
                    onClick={() => setAnswer(opt)}
                    className={
                      "w-full text-right px-4 py-4 rounded-xl border text-[15px] font-medium transition-all break-words " +
                      (active
                        ? "border-accent bg-accent text-accent-foreground shadow-soft"
                        : "border-border bg-background hover:bg-accent/10 hover:border-accent/40")
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              value={selected}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="התשובה שלך…"
              className="w-full rounded-xl border border-input bg-transparent px-3 py-3 text-[15px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none"
            />
          )}
        </div>

        <div className="mt-5 space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleContinue}
            disabled={!hasAnswer || loading}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> בודקים…</>
            ) : isLast ? (
              "בדוק את הכיסוי"
            ) : (
              "המשך"
            )}
          </Button>
          <button
            type="button"
            onClick={handleBack}
            disabled={loading}
            className="w-full text-sm text-muted-foreground hover:text-foreground py-2 disabled:opacity-50"
          >
            חזור
          </button>
        </div>
      </div>
    </div>
  );
}

function CriteriaCard({ item, showSource, setShowSource }) {
  return (
    <div className="bg-tint-blue rounded-2xl border border-border p-5">
      <h3 className="font-heading font-semibold mb-1">מה הפוליסה דורשת</h3>
      <p className="text-[15px] leading-relaxed text-foreground/90 break-words">
        {item.policy_requirements || "לא זיהינו תנאים מפורשים בנוסח הפוליסה."}
      </p>
      {item.source_text && (
        <button onClick={() => setShowSource(!showSource)} className="mt-3 text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          {showSource ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          נוסח מקורי {item.source_clause ? `· סעיף ${item.source_clause}` : ""}
        </button>
      )}
      {showSource && item.source_text && (
        <div className="mt-2 bg-background/60 rounded-xl p-3 text-sm text-muted-foreground leading-relaxed border border-border whitespace-pre-wrap break-words">
          {item.source_text}
        </div>
      )}
    </div>
  );
}