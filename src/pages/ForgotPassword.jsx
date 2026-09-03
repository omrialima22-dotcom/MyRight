import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="איפוס סיסמה"
      subtitle="נשלח לכם קישור לאיפוס הסיסמה"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
          <ArrowRight className="w-3 h-3" /> חזרה להתחברות
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground text-center leading-relaxed">
          אם קיים חשבון עם האימייל הזה, תקבלו בקרוב קישור לאיפוס הסיסמה.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">כתובת אימייל</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pr-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                שולח…
              </>
            ) : (
              "שליחת קישור לאיפוס"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}