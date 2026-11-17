import Link from "next/link";

export const CONTACT_EMAIL = "zeyadmandor2008@gmail.com";
export const UPDATED = "November 17, 2026";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="stage legal" style={{ maxWidth: 760, margin: "0 auto" }}>
      <p style={{ margin: "0 0 28px" }}><Link href="/" className="logo">rply</Link></p>
      <h1 className="h2">{title}</h1>
      <p className="meta" style={{ marginTop: 12 }}>Last updated {UPDATED}</p>
      <div style={{ display: "grid", gap: 14, marginTop: 28, lineHeight: 1.6 }}>{children}</div>
      <p style={{ marginTop: 40, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms of service</Link>
        <Link href="/data-deletion">Data deletion</Link>
      </p>
    </main>
  );
}

export function H({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 className="h3" id={id} style={{ marginTop: 18 }}>{children}</h2>;
}
