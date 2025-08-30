"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Landmark, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile } from "@/lib/db/profiles";
function useShowCongregationTab() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (!id) return setOk(false);
        const p = await getProfile(id);
        const isElder = Array.isArray((p as any)?.privileges) && (p as any).privileges.includes('Elder');
        const isSuperadmin = (p as any)?.role === "superadmin";
        const assigned = !!(p as any)?.congregation_id;
        let admin = false;
        try {
          const { data: isAdm } = await supabase.rpc("is_admin", { uid: id });
          admin = !!isAdm;
        } catch {}
        setOk(assigned || isSuperadmin || (admin && isElder));
      } catch {
        setOk(false);
      }
    })();
  }, []);
  return ok;
}

function useShowBusinessTab() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      try {
        await supabase.auth.getSession();
        const { data: enabled } = await supabase.rpc('is_business_enabled');
        const { data: participant } = await supabase.rpc('is_business_participant');
        setOk(!!enabled && !!participant);
      } catch {
        setOk(false);
      }
    })();
  }, []);
  return ok;
}

export default function BottomNav() {
  const pathname = usePathname();
  const showCong = useShowCongregationTab();
  const showBiz = useShowBusinessTab();
  const tabs = [
    { href: "/", label: "Home", icon: Home },
    ...(showCong ? [{ href: "/congregation", label: "Congregation", icon: Landmark }] : []),
    ...(showBiz ? [{ href: "/business", label: "Business", icon: Briefcase }] : []),
    { href: "/account", label: "Account", icon: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/80 backdrop-blur md:hidden pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <div className="mx-auto flex max-w-screen-sm items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex flex-col items-center justify-center gap-1 py-3 w-full text-xs
                ${active ? "text-foreground" : "text-foreground/60"}`}
            >
              <Icon className={`h-5 w-5 ${active ? "" : "opacity-70"}`} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
