import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the session is at AAL1 but the account has verified MFA factors,
 * so the JWT should be stepped up to AAL2 — and we have at least one WebAuthn
 * (passkey) factor to complete that step.
 *
 * Requires WebAuthn MFA to be enabled on the Supabase project (Auth → MFA).
 */
export async function computeMfaPasskeyRequired(supabase: SupabaseClient): Promise<boolean> {
  const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr || !aalData) return false;

  const current = aalData.currentLevel ?? "aal1";
  const next = aalData.nextLevel;
  if (current !== "aal1" || next !== "aal2") return false;

  const { data: factors, error: facErr } = await supabase.auth.mfa.listFactors();
  if (facErr || !factors) return false;

  return factors.webauthn.length > 0;
}
