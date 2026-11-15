"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";
import { login, signup } from "./actions";

export function LoginForm({ signup: isSignup, email }: { signup: boolean; email?: string }) {
  const [state, action, pending] = useActionState(isSignup ? signup : login, null as null | { error?: string; email?: string });
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const strength = pw.length === 0 ? "" : pw.length < 8 ? "Too short: use at least 8 characters" : /[0-9]/.test(pw) && /[a-zA-Z]/.test(pw) && pw.length >= 10 ? "Strong password" : "OK. Longer with numbers is safer";

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      {isSignup && (
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="field"><span>Your name</span><input className="input" name="name" autoComplete="name" placeholder="Mariam Adel" /></label>
          <label className="field"><span>Brand or agency</span><input className="input" name="brand" placeholder="Wasla Agency" /></label>
        </div>
      )}
      <label className="field"><span>Email</span>
        <input className="input" name="email" type="email" autoComplete="email" required defaultValue={state?.email ?? email} placeholder="you@brand.com" autoFocus={!email} />
      </label>
      <label className="field"><span>Password</span>
        <span className="pw">
          <input className="input" name="password" type={show ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} required minLength={8}
            value={pw} onChange={(e) => setPw(e.target.value)} autoFocus={Boolean(email)} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeSlash size={20} /> : <Eye size={20} />}</button>
        </span>
        {isSignup && strength && <small aria-live="polite" style={{ color: pw.length < 8 ? "var(--tomato)" : undefined }}>{strength}</small>}
      </label>
      {state?.error && <p role="alert" style={{ margin: 0, color: "var(--tomato)", fontWeight: 600 }}>{state.error}</p>}
      <button className="btn btn-lg" disabled={pending}>{pending ? "One sec…" : isSignup ? "Create workspace" : "Log in"}{!pending && <ArrowRight size={18} weight="bold" />}</button>
      <p className="muted" style={{ margin: 0, textAlign: "center" }}>
        {isSignup ? <>Already have a workspace? <Link href="/login" style={{ fontWeight: 700, color: "#000" }}>Log in</Link></>
                  : <>New to rply? <Link href="/login?mode=signup" style={{ fontWeight: 700, color: "#000" }}>Create a workspace</Link></>}
      </p>
    </form>
  );
}
