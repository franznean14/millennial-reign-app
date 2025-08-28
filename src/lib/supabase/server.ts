import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const createSupabaseServerClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        try {
          cookieStore.set(name, value, options);
        } catch {}
      },
      remove: (name: string, options: any) => {
        try {
          cookieStore.set(name, "", { ...options, expires: new Date(0) });
        } catch {}
      },
    },
  });
};
