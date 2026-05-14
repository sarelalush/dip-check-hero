import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Mail, Lock, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "הרשמה — AquaSense" }] }),
  component: SignupScreen,
});

function SignupScreen() {
  const { signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setErr("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    setBusy(true);
    setErr("");
    const { error } = await signUpWithEmail(email.trim(), password, name.trim());
    setBusy(false);
    if (error) setErr(error);
    else {
      setOk("נשלח אליכם דוא\"ל לאימות. לחצו על הקישור כדי לאשר את החשבון.");
      setTimeout(() => navigate({ to: "/login" }), 2500);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setErr(typeof r.error === "string" ? r.error : (r.error as Error).message);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-white">
      <div className="mx-auto max-w-md px-6 pb-10 pt-8">
        <Link to="/welcome" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          חזרה <ArrowRight className="h-4 w-4" />
        </Link>

        <div className="mt-8 text-right">
          <h1 className="text-3xl font-extrabold text-foreground">יצירת חשבון</h1>
          <p className="mt-2 text-sm text-muted-foreground">שמרו את הבריכות והבדיקות שלכם לתמיד.</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="שם מלא" icon={<User className="h-4 w-4" />}>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="ישראל ישראלי"
              className="w-full bg-transparent text-right outline-none placeholder:text-muted-foreground" />
          </Field>
          <Field label='כתובת דוא"ל' icon={<Mail className="h-4 w-4" />}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"
              className="w-full bg-transparent text-right outline-none placeholder:text-muted-foreground" />
          </Field>
          <Field label="סיסמה (6 תווים לפחות)" icon={<Lock className="h-4 w-4" />}>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-right outline-none" />
          </Field>

          {err && <p className="text-sm text-destructive">{err}</p>}
          {ok && <p className="text-sm text-success">{ok}</p>}

          <button type="submit" disabled={busy}
            className="w-full rounded-full py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.14 220), oklch(0.72 0.14 195))" }}>
            {busy ? "יוצר חשבון…" : "יצירת חשבון"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />או<div className="h-px flex-1 bg-border" />
        </div>

        <button onClick={google}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-white py-3.5 font-semibold text-foreground shadow-sm transition active:scale-[0.98]">
          <GoogleIcon /> הרשמה עם Google
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          כבר יש לכם חשבון?{" "}
          <Link to="/login" className="font-bold text-primary">התחברות</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-right text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-3 shadow-sm focus-within:border-primary">
        {children}
        <span className="text-muted-foreground">{icon}</span>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.4 4.5 9.8 8.7 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-5.1c-2 1.4-4.4 2.1-6.9 2.1-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.7 39.2 16.3 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.4l6 5.1c-.4.4 6.7-4.9 6.7-14.5 0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
