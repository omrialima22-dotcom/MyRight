import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft, CalendarDays } from "lucide-react";

export default function TransitionStep({ summary, timeline }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <ShieldCheck className="w-6 h-6 text-primary" />
      </div>

      <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
        מעולה, עכשיו יש לנו תמונה טובה יותר של מה שעברת
      </h1>
      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-6">
        עכשיו בואו נבדוק אילו ביטוחים היו לכם בתקופה הזאת, כדי שנוכל לזהות זכויות שאולי מגיעות לכם.
      </p>

      {summary && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-5">
          <p className="text-sm text-muted-foreground mb-1 font-medium">תמונת מצב ראשונית</p>
          <p className="text-foreground leading-relaxed">{summary}</p>
        </div>
      )}

      {timeline && timeline.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">ציר הזמן שנבנה</p>
          </div>
          <div className="space-y-3">
            {timeline.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="font-medium">{item.label}</span>
                {item.date && <span className="text-sm text-muted-foreground">— {item.date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Link to="/policies">
        <Button size="lg" className="w-full h-12 text-base font-medium">
          בדיקת הביטוחים שלי
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </Link>
    </div>
  );
}