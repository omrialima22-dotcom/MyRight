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
    return false; // quick answers submit directly
  };

  const submitText = () => {
    if (!canSubmit()) return;
    onAnswer(type === "date" ? dateValue : textValue.trim());
    setTextValue("");
    setDateValue("");
  };

  return (
    <div className="max-w-2xl mx-auto">
      {title && <h2 className="text-xl lg:text-2xl font-heading font-bold mb-2">{title}</h2>}
      {subtitle && <p className="text-muted-foreground text-sm lg:text-base leading-relaxed mb-4">{subtitle}</p>}
      <p className="text-lg lg:text-xl font-medium leading-relaxed mb-6">{prompt}</p>

      {type === "quick" && (
        <div className="grid gap-3">
          {(options || []).map((opt, i) => (
            <button
              key={i}
              disabled={loading}
              onClick={() => onAnswer(opt)}
              className="group flex items-center justify-between w-full rounded-xl border border-border bg-card px-5 py-4 text-right text-base font-medium hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
            >
              <span>{opt}</span>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
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
            className="min-h-[120px] text-base leading-relaxed"
            autoFocus
          />
          <Button
            onClick={submitText}
            disabled={loading || !canSubmit()}
            size="lg"
            className="w-full h-12 text-base font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                טוען…
              </>
            ) : (
              "המשך"
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
            className="h-12 text-base"
            autoFocus
          />
          <Button
            onClick={submitText}
            disabled={loading || !canSubmit()}
            size="lg"
            className="w-full h-12 text-base font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                טוען…
              </>
            ) : (
              "המשך"
            )}
          </Button>
        </div>
      )}

      {type === "quick" && loading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mt-5">
          <Loader2 className="w-4 h-4 animate-spin" />
          טוען…
        </div>
      )}
    </div>
  );
}