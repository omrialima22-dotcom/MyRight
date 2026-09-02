import React, { useState, useEffect } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReviewProgress from "@/components/eligibility/ReviewProgress";

export default function GlobalQuestionFlow({
  question,
  initialValue,
  editMode,
  progress,
  onContinue,
  onBack,
  canBack,
  loading
}) {
  const [selected, setSelected] = useState(initialValue || "");

  useEffect(() => {
    setSelected(initialValue || "");
  }, [question?.fact_key, editMode, initialValue]);

  if (!question) return null;

  const isQuick = question.answer_type === "quick" && question.options?.length;
  const hasAnswer = !!selected;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        disabled={!canBack || loading}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <ArrowRight className="w-4 h-4" /> חזרה
      </button>

      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-soft">
        <ReviewProgress {...progress} />

        <div key={question.fact_key + (editMode ? "-e" : "-f")} className="animate-fade-up">
          {editMode && (
            <p className="text-xs text-muted-foreground mb-2">סקירת תשובה קודמת — ניתן לערוך</p>
          )}
          <p className="text-lg font-medium leading-relaxed mb-4 break-words">{question.prompt}</p>

          {isQuick ? (
            <div className="grid gap-2.5">
              {question.options.map((opt) => {
                const active = opt === selected;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={loading}
                    onClick={() => setSelected(opt)}
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
              onChange={(e) => setSelected(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="התשובה שלך…"
              className="w-full rounded-xl border border-input bg-transparent px-3 py-3 text-[15px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none"
            />
          )}
        </div>

        <div className="mt-5">
          <Button
            className="w-full"
            size="lg"
            onClick={() => onContinue(selected)}
            disabled={!hasAnswer || loading}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מעדכן…</>
            ) : editMode ? (
              "שמירת התשובה"
            ) : (
              "המשך"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}