import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export default function StoryStep({ onSubmit, loading }) {
  const [text, setText] = useState("");

  const submit = () => {
    if (text.trim().length < 3) return;
    onSubmit(text.trim());
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
        נתחיל ממה שקרה
      </h1>
      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-6">
        ספרו לנו בקצרה מה השתנה במצב הבריאותי שלכם. אין צורך להשתמש במונחים רפואיים או ביטוחיים.
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="לפני שנה אובחנתי במחלה ועברתי כמה חודשים של טיפולים…"
        className="min-h-[160px] text-base leading-relaxed mb-5"
        autoFocus
      />

      <Button
        onClick={submit}
        disabled={loading || text.trim().length < 3}
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
  );
}