import React, { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CoverageCheckFlow({ item, answers, onAnswer, onComplete, onBack, loading }) {
  const [showSource, setShowSource] = useState(false);
  const questions = item.questions || [];

  if (questions.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-4 h-4" /> חזרה לרשימה
        </button>
        <CriteriaCard item={item} showSource={showSource} setShowSource={setShowSource} />
        <div className="bg-card rounded-2xl border border-border p-5 text-center shadow-soft">
          <p className="text-sm text-muted-foreground mb-4">אין שאלות נוספות לבדיקה. נבדוק את ההתאמה האפשרית מול תנאי הפוליסה.</p>
          <Button onClick={onComplete} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> בודקים…</> : "בוא נבדוק התאמה"}
          </Button>
        </div>
      </div>
    );
  }

  const answeredCount = answers.length;
  const current = questions[answeredCount];
  const allAnswered = answeredCount >= questions.length;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> חזרה לרשימה
      </button>

      <CriteriaCard item={item} showSource={showSource} setShowSource={setShowSource} />

      <div className="bg-card rounded-2xl border border-border p-5 shadow-soft">
        {allAnswered ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">ענית על כל השאלות. נבדוק את ההתאמה האפשרית מול תנאי הפוליסה.</p>
            <Button onClick={onComplete} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> בודקים…</> : "בוא נבדוק התאמה"}
            </Button>
          </div>
        ) : (
          <QuestionBlock question={current} onAnswer={(a) => onAnswer(current, a)} loading={loading} />
        )}
        <div className="mt-4 text-xs text-muted-foreground">{answeredCount} מתוך {questions.length} תשובות</div>
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

function QuestionBlock({ question, onAnswer, loading }) {
  const [text, setText] = useState("");
  const isQuick = question.answer_type === "quick" && question.options?.length;
  return (
    <div>
      <p className="text-[15px] font-medium leading-relaxed mb-3">{question.prompt}</p>
      {isQuick ? (
        <div className="grid grid-cols-2 gap-2">
          {question.options.map((opt) => (
            <button key={opt} disabled={loading} onClick={() => onAnswer(opt)}
              className="px-4 py-3 rounded-xl border border-border bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition disabled:opacity-50 break-words">
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-transparent px-3 py-2 text-sm min-w-0"
            placeholder="התשובה שלך" />
          <Button disabled={loading || !text.trim()} onClick={() => { onAnswer(text.trim()); setText(""); }}>המשך</Button>
        </div>
      )}
    </div>
  );
}