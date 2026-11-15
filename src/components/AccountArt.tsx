import { FacebookLogo, InstagramLogo } from "@phosphor-icons/react/dist/ssr";
import { Art } from "./Art";
import { look } from "./characters";

export function AccountArt({ seed, platform, status, label }: { seed: string; platform: "facebook" | "instagram"; status: string; label?: string }) {
  const l = look(seed);
  const Logo = platform === "instagram" ? InstagramLogo : FacebookLogo;
  return (
    <div className={`acard-art ${l.pattern} ${status !== "active" ? "is-paused" : ""}`} style={{ background: l.fill }}>
      <span className="badge" title={label}><Logo size={15} weight="fill" style={{ flex: "none" }} />{label ?? (platform === "instagram" ? "Instagram" : "Facebook")}</span>
      {status === "error" && <span className="badge badge-r" style={{ background: "var(--tomato)" }}>Reconnect</span>}
      {status === "paused" && <span className="badge badge-r">Paused</span>}
      <Art name={l.char} size={256} className="char" />
    </div>
  );
}
