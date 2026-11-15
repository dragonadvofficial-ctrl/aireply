import Link from "next/link";
import { Art } from "./Art";

export function Logo({ href = "/", word = true }: { href?: string; word?: boolean }) {
  return (
    <Link href={href} className="logo" aria-label="rply home">
      <span className="logo-mark"><Art name="bub-head" size={34} className="" eager /></span>
      {word && <span>rply</span>}
    </Link>
  );
}
