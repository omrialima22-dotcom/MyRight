import React from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft } from "lucide-react";

const steps = [
  { num: "01", title: "מספרים לנו מה קרה", desc: "בלי מונחים רפואיים או ביטוחיים — פשוט מספרים." },
  { num: "02", title: "מוצאים ומעלים את הביטוחים", desc: "נלווה אותך גם אם לא יודע איפה הם נמצאים." },
  { num: "03", title: "MyRight בודקת מה כדאי לבדוק", desc: "מנתחת את הכיסויים ומציעה זכויות אפשריות." }
];

export default function Home() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-10 lg:py-20">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5 mb-10 lg:mb-14">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-soft">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg">MyRight</span>
        </div>

        {/* Hero */}
        <h1 className="font-display font-bold leading-[1.08] tracking-tight mb-5 text-[2rem] lg:text-[3.1rem]">
          הביטוח שלך מסובך.
          <br />
          <span className="text-muted-foreground">להבין מה מגיע לך לא צריך להיות.</span>
        </h1>
        <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl mb-8">
          ספרו לנו מה קרה, ואנחנו נלווה אותכם צעד אחר צעד בבדיקת הביטוחים שלכם.
        </p>
        <Link to="/rights-check">
          <Button size="lg" className="h-12 px-7 text-base rounded-2xl">
            מתחילים לבדוק
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>

        {/* Steps */}
        <div className="mt-16 lg:mt-24">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className="flex items-start gap-5 py-6 border-t border-border last:border-b"
            >
              <span className="font-display font-bold text-2xl text-muted-foreground/50 w-10 shrink-0">
                {s.num}
              </span>
              <div>
                <p className="font-heading font-bold text-lg lg:text-xl mb-1">{s.title}</p>
                <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}