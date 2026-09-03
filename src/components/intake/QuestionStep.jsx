import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft } from "lucide-react";

export default function QuestionStep({ question, onAnswer, loading }) {
  const [textValue, setTextValue] = useState("");
  const [dateValue, setDateValue] = useState("");

  if (!question) return null;

  const { title, subtitle, prompt, answer_type, options } = question;
  const type = answer_type || "quick";

  const canSubmit = () => {
    if (type === "text") return textValue.trim().length >= 2;
    if (type === "date") return !!dateValue;
    return false;
  };

  const submitText = () => {
    if (!canSubmit()) return;
    onAnswer(type === "date" ? dateValue : textValue.trim());
    setTextValue("");
    setDateValue("");
  };

  return (
    <div className="max-w-2xl animate-fade-up">
      {title && <h2 className="font-display font-bold text-xl lg:text-2xl mb-2">{title}</h2>}
      {subtitle && <p className="text-muted-foreground leading-relaxed mb-4">{subtitle}</p>}
      <p className="text-xl lg:text-2xl font-heading font-semibold leading-snug mb-8">{prompt}</p>

      {type === "quick" && (
        <div className="grid gap-3">
          {(options || []).map((opt, i) => (
            <button
              key={i}
              disabled={loading}
              onClick={() => onAnswer(opt)}
              className="group flex items-center justify-between w-full rounded-2xl bg-card px-6 py-5 text-right text-lg font-medium shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              <span>{opt}</span>
              <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      )}

      {type === "text" && (
        <div className="space-y-4">
          <Textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="הקלידו כאן…"
            className="min-h-[140px] text-lg leading-relaxed rounded-2xl bg-card shadow-soft focus-visible:ring-primary"
            autoFocus
          />
          <Button
            onClick={submitText}
            disabled={loading || !canSubmit()}
            size="lg"
            className="w-full h-12 text-base rounded-2xl"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                טוען…
              </>
            ) : (
              <>
                המשך
                <ArrowLeft className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      )}

      {type === "date" && (
        <div className="space-y-4">
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="h-14 text-base rounded-2xl bg-card shadow-soft"
            autoFocus
          />
          <Button
            onClick={submitText}
            disabled={loading || !canSubmit()}
            size="lg"
            className="w-full h-12 text-base rounded-2xl"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                טוען…
              </>
            ) : (
              <>
                המשך
                <ArrowLeft className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      )}

      {type === "quick" && loading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mt-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          טוען…
        </div>
      )}
    </div>
  );
}