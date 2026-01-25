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
      try {
        // Use Supabase RPC function to check if user has password auth
        const { data: hasPasswordAuth, error: rpcError } = await supabase.rpc("has_password_auth");
        
        if (!rpcError && hasPasswordAuth === true) {
          localStorage.setItem("has_password", "1");
          setHasPassword(true);
          return;
        }

        // Fallback: Check localStorage (set when password is added)
        const stored = localStorage.getItem("has_password");
        if (stored === "1") {
          setHasPassword(true);
          return;
        }

        // Fallback: Check user identities from auth.getUser()
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if user has email provider in identities
          if (user.identities && Array.isArray(user.identities)) {
            const hasEmailIdentity = user.identities.some(
              (identity: any) => identity.provider === "email"
            );
            if (hasEmailIdentity) {
              localStorage.setItem("has_password", "1");
              setHasPassword(true);
              return;
            }
          }

          // Fallback: check app_metadata provider
          const hasEmailPassword = user.app_metadata?.provider === "email";
          if (hasEmailPassword) {
            localStorage.setItem("has_password", "1");
            setHasPassword(true);
            return;
          }
        }

        // If none of the above, user doesn't have password
        localStorage.setItem("has_password", "0");
        setHasPassword(false);
      } catch (error) {
        console.error("Error checking password status:", error);
        // Fallback to localStorage if available
        const stored = localStorage.getItem("has_password");
        setHasPassword(stored === "1");
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
