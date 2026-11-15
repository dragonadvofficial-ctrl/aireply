"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`mnav ${scrolled ? "scrolled" : ""}`}>
      <div className="mnav-inner">
        <Logo />
        <nav className="mnav-links" aria-label="Main">
          <a href="#how">How it thinks</a>
          <a href="#squads">Squads</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <Link href="/login" className="btn btn-sm btn-line">Log in</Link>
          <Link href="/login?mode=signup" className="btn btn-sm">Start free</Link>
        </div>
      </div>
    </header>
  );
}
