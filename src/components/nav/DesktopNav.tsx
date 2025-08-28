"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User } from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/account", label: "Account", icon: User },
];

export default function DesktopNav() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-56px)] w-60 shrink-0 border-r border-border/70 md:block">
      <nav className="p-3 grid gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition
                ${active ? "bg-muted font-medium" : "hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
