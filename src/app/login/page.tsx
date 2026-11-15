import { Art } from "@/components/Art";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./form";

export const metadata = { title: "Log in — rply" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; email?: string }> }) {
  const { mode, email } = await searchParams;
  const signup = mode === "signup";
  return (
    <main className="auth">
      <section className="auth-form">
        <div>
          <Logo />
          <div className="stack" style={{ gap: 10 }}>
            <h1 className="h2">{signup ? "Make your workspace" : "Welcome back"}</h1>
            <p className="lede" style={{ fontSize: 16 }}>
              {signup ? "No confirmation email. You’re in the second you hit create." : "Log in with the email and password you signed up with."}
            </p>
          </div>
          <LoginForm signup={signup} email={email} />
        </div>
      </section>

      <aside className="auth-side deck" aria-hidden="true">
        <div style={{ position: "absolute", inset: 0, display: "grid", alignContent: "start", justifyItems: "center", gap: 18, padding: "64px 40px", zIndex: 2 }}>
          <div className="stack" style={{ width: "min(100%, 400px)", gap: 12, position: "relative", zIndex: 2 }}>
            <div className="bubble bubble-in" dir="auto" style={{ border: 0, color: "#000" }}>عندكم فرع في التجمع؟ وبتقفلوا الساعة كام؟</div>
            <div className="bubble" dir="auto" style={{ background: "#dcff3a", color: "#000", justifySelf: "end", borderBottomRightRadius: 6 }}>أيوه في التجمع الخامس ✨ فاتحين لحد ٢ بالليل</div>
            <div className="meta" style={{ textAlign: "right", color: "#9a9a95" }}>Instant reply, 0 AI tokens</div>
            <div className="bubble bubble-in" dir="auto" style={{ border: 0, color: "#000", marginTop: 10 }}>عايز أحجز ترابيزة لـ ٦ بكرة الساعة ٩</div>
            <div className="bubble bubble-draft" dir="auto" style={{ borderColor: "#dcff3a", background: "transparent", color: "#fff" }}>تمام! هأكدلك الحجز خلال دقايق 🙏</div>
            <div className="meta" style={{ textAlign: "right", color: "#9a9a95" }}>Drafted and sent to your inbox: bookings need a human</div>
          </div>
        </div>
        <Art name="bub" size={800} className="art auth-char" />
                <div className="tile" style={{ left: "6%", bottom: "16%", ["--rot" as any]: "5deg", ["--d" as any]: ".3s", ["--bg" as any]: "#7c5cff", zIndex: 3 }}><Art name="obj-typing" size={84} className="" /></div>
        <div className="tile" style={{ right: "6%", bottom: "22%", ["--rot" as any]: "-6deg", ["--d" as any]: ".22s", ["--bg" as any]: "#8ed3ff", zIndex: 3 }}><Art name="obj-chip" size={84} className="" /></div>
      </aside>
    </main>
  );
}
