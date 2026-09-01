import React from "react";
import { Button } from "@/components/ui/button";
import { HeartPulse, HeartHandshake, Briefcase, ArrowLeft } from "lucide-react";

const TYPES = [
  { icon: HeartPulse, title: "ביטוח בריאות", desc: "ביטוח שעוזר עם הוצאות רפואיות, טיפולים ואשפוז." },
  { icon: HeartHandshake, title: "ביטוח חיים", desc: "ביטוח שקשור למקרה פטירה או מחלה קשה." },
  { icon: Briefcase, title: "אובדן כושר עבודה", desc: "ביטוח שמפצה כשלא מצליחים לעבוד בעקבות מצב רפואי." }
];

export default function StepFind({ onNext }) {
  return (
    <div>
      <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
        איזה ביטוחים נחפש?
      </h1>
      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-6">
        אנחנו מחפשים ביטוחים פרטיים שעשויים להיות רלוונטיים לשינוי במצב הבריאותי.
        אתה לא צריך להחליט בעצמך מה רלוונטי — רק לאסוף את המידע, ו-MyRight תנתח אותו לאחר מכן.
      </p>

      <div className="space-y-3 mb-7">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold mb-0.5">{t.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={onNext} size="lg" className="w-full h-12 text-base font-medium">
        הבנתי, ממשיך
        <ArrowLeft className="w-5 h-5" />
      </Button>
    </div>
  );
}