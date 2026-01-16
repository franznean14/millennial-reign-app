"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function useAccountState({
  userId,
  getSupabaseClient
}: {
  userId: string | null;
  getSupabaseClient: () => Promise<SupabaseClient>;
}) {
  const [editing, setEditing] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<"profile" | "account">("profile");

  useEffect(() => {
    if (!userId) return;
    const loadAccountData = async () => {
      const supabase = await getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const hasEmailPassword = user.app_metadata?.provider === "email";
          localStorage.setItem("has_password", hasEmailPassword ? "1" : "0");
          setHasPassword(hasEmailPassword);
        } catch {}
      }
    };
    loadAccountData();
  }, [userId, getSupabaseClient]);

  return {
    editing,
    setEditing,
    editAccountOpen,
    setEditAccountOpen,
    passwordOpen,
    setPasswordOpen,
    hasPassword,
    setHasPassword,
    privacyPolicyOpen,
    setPrivacyPolicyOpen,
    accountTab,
    setAccountTab
  };
}
