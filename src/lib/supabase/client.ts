"use client";

import { createBrowserClient } from "@supabase/ssr";

export const createSupabaseBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Missing Supabase environment variables.");
  }

  return createBrowserClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
    cookies: {
      // Let the client read/write cookies to keep SSR/CSR in sync if needed
      get(name: string) {
        if (typeof document === "undefined") return undefined;
        const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"));
        return match ? decodeURIComponent(match[1]) : undefined;
      },
      set(name: string, value: string, options: any) {
        if (typeof document === "undefined") return;
        let cookie = `${name}=${encodeURIComponent(value)}`;
        if (options?.maxAge) cookie += `; Max-Age=${options.maxAge}`;
        if (options?.expires) cookie += `; Expires=${options.expires.toUTCString?.() ?? options.expires}`;
        cookie += "; Path=/";
        document.cookie = cookie;
      },
      remove(name: string, options: any) {
        if (typeof document === "undefined") return;
        document.cookie = `${name}=; Max-Age=0; Path=/`;
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};
