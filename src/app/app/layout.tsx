import { Nav } from "@/components/Nav";
import { requireSession } from "@/lib/auth";
import { needsYou } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const initials = (s.name || s.email).split(/[\s@.]/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return (
    <>
      <Nav initials={initials} needsYou={await needsYou(s.wid)} />
      <main className="app-main">{children}</main>
    </>
  );
}
