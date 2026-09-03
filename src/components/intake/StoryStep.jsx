import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft } from "lucide-react";

export default function StoryStep({ onSubmit, loading }) {
  const [text, setText] = useState("");

  const submit = () => {
    if (text.trim().length < 3) return;
    onSubmit(text.trim());
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-bold text-[1.75rem] lg:text-[2.25rem] leading-[1.15] tracking-tight mb-4">
        נתחיל ממה שקרה
      </h1>
      <p className="text-muted-foreground text-lg leading-relaxed mb-8">
        ספרו לנו בקצרה מה השתנה במצב הבריאותי שלכם. אין צורך במונחים רפואיים או ביטוחיים.
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="לפני שנה אובחנתי במחלה ועברתי כמה חודשים של טיפולים…"
        className="min-h-[180px] text-lg leading-relaxed mb-6 rounded-2xl border-border bg-card shadow-soft focus-visible:ring-primary"
        autoFocus
      />

      <Button
        onClick={submit}
        disabled={loading || text.trim().length < 3}
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
  );
}