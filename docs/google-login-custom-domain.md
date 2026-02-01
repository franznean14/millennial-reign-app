# Changing "You are signing in to xxx.supabase.com" on Google Login

Google shows the **OAuth callback domain** during sign-in (e.g. "You are signing in to **yourproject.supabase.co**"). That domain is your Supabase project URL, because the callback URL is `https://<project>.supabase.co/auth/v1/callback`.

To show **your own domain** (e.g. `api.yourapp.com` or `auth.yourapp.com`) instead of `xxx.supabase.co`, you need to use a **custom domain** (or a **vanity subdomain**) for your Supabase project. Both are configured in Supabase; then you point your app and Google at the new URL.

---

## Option 1: Custom domain (e.g. `api.yourapp.com`)

**Requirements:** Supabase paid plan; you need a subdomain (e.g. `api.yourapp.com`, not `yourapp.com`).

### 1. Add the custom domain in Supabase

- **Dashboard:** [Project → Settings → General → Custom Domains](https://supabase.com/dashboard/project/_/settings/general), or add-on: [Custom Domain add-on](https://supabase.com/dashboard/project/_/settings/addons?panel=customDomain).
- **CLI:** See [Custom Domains](https://supabase.com/docs/guides/platform/custom-domains):
  1. Add a **CNAME**: `api.yourapp.com` → `yourproject.supabase.co`
  2. Add the **TXT** record Supabase gives you (domain verification).
  3. Run `supabase domains reverify --project-ref <ref>` until it succeeds.
  4. Run `supabase domains activate --project-ref <ref>`.

### 2. Add the new callback URL in Google

In [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) → your OAuth 2.0 Client:

- **Authorized redirect URIs:** add (in addition to the existing one):
  - `https://api.yourapp.com/auth/v1/callback`
- Keep the existing Supabase URL for now: `https://yourproject.supabase.co/auth/v1/callback`

Get the exact callback URL from: [Supabase Dashboard → Authentication → Providers → Google](https://supabase.com/dashboard/project/_/auth/providers?provider=Google).

### 3. Use the custom URL in your app

Set the Supabase URL to your custom domain:

```env
NEXT_PUBLIC_SUPABASE_URL=https://api.yourapp.com
```

Your app already uses `NEXT_PUBLIC_SUPABASE_URL` in `src/lib/supabase/client.ts`, so after this change all auth (including Google) will use `api.yourapp.com`. Google will then show "You are signing in to **api.yourapp.com**" instead of `xxx.supabase.co`.

---

## Option 2: Vanity subdomain (e.g. `my-app.supabase.co`)

**Requirements:** Paid plan; CLI only; experimental.

You get a friendlier Supabase hostname like `my-app.supabase.co` instead of the random `abcdef...supabase.co`. Google will show that instead of the long project ID.

- See [Custom Domains → Vanity subdomains](https://supabase.com/docs/guides/platform/custom-domains#vanity-subdomains).
- Check availability: `supabase vanity-subdomains --project-ref <ref> check-availability --desired-subdomain my-app --experimental`
- In **Google** → Authorized redirect URIs, add: `https://my-app.supabase.co/auth/v1/callback`
- Activate: `supabase vanity-subdomains --project-ref <ref> activate --desired-subdomain my-app --experimental`
- In your app: `NEXT_PUBLIC_SUPABASE_URL=https://my-app.supabase.co`

---

## Summary

| Goal                         | What to do |
|-----------------------------|------------|
| Change the domain Google shows | Use a Supabase **custom domain** or **vanity subdomain** so the auth callback host is your domain (or `*.supabase.co`). |
| Point your app at that domain   | Set `NEXT_PUBLIC_SUPABASE_URL` to that URL (e.g. `https://api.yourapp.com` or `https://my-app.supabase.co`). |
| Keep Google working             | Add the **new** callback URL (`https://<your-custom-domain>/auth/v1/callback`) in Google Cloud Console → OAuth client → Authorized redirect URIs. |

You cannot change the wording of Google’s message itself; you can only change the **domain** it shows by using a custom or vanity Supabase URL and updating your app and Google redirect URIs as above.
