"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Brain, ChatsCircle, DotsThreeOutline, Flask, House, Microphone, ChartBar, SquaresFour, UsersThree } from "@phosphor-icons/react";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/app", label: "Overview", icon: House, main: true },
  { href: "/app/inbox", label: "Inbox", icon: ChatsCircle, main: true },
  { href: "/app/accounts", label: "Accounts", icon: SquaresFour, main: true },
  { href: "/app/brain", label: "Brain", icon: Brain, main: true },
  { href: "/app/squads", label: "Squads", icon: UsersThree },
  { href: "/app/voice", label: "Voice", icon: Microphone },
  { href: "/app/playground", label: "Playground", icon: Flask },
  { href: "/app/usage", label: "Usage", icon: ChartBar },
];

export function Nav({ initials, needsYou }: { initials: string; needsYou: number }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  const current = LINKS.find((l) => isActive(l.href));
  const more = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (more.current) more.current.open = false; }, [path]);

  return (
    <>
      <header className="nav">
        <Logo href="/app" word={false} />
        <span className="nav-title" style={{ display: "none" }}>{current?.label}</span>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link" aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label}{l.href === "/app/inbox" && needsYou > 0 && <span className="count">{needsYou}</span>}
            </Link>
          ))}
        </nav>
        <div className="nav-right">
          <Link href="/app/accounts#connect" className="btn btn-sm">Connect account</Link>
          <form action="/logout" method="post"><button className="avatar" title="Log out" aria-label="Log out">{initials}</button></form>
        </div>
      </header>

      <nav className="tabbar" aria-label="Main">
        {LINKS.filter((l) => l.main).map((l) => (
          <Link key={l.href} href={l.href} className="tab-item" aria-current={isActive(l.href) ? "page" : undefined}>
            <l.icon size={23} weight={isActive(l.href) ? "fill" : "regular"} />
            {l.label}
            {l.href === "/app/inbox" && needsYou > 0 && <span className="count">{needsYou}</span>}
          </Link>
        ))}
        <details className="more-sheet" ref={more}>
          <summary className="tab-item" aria-current={LINKS.some((l) => !l.main && isActive(l.href)) ? "page" : undefined}>
            <DotsThreeOutline size={23} weight="fill" />More
          </summary>
          <div className="more-panel">
            {LINKS.filter((l) => !l.main).map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}><l.icon size={20} />{l.label}</Link>
            ))}
            <Link href="/app/accounts#connect"><SquaresFour size={20} />Connect account</Link>
          </div>
        </details>
      </nav>
    </>
  );
}
