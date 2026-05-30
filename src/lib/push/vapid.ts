import webpush from "web-push";

let configured = false;

export function ensureWebPushVapidConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails("mailto:notifications@millennialreign.app", publicKey, privateKey);
    configured = true;
  }
  return true;
}

export { webpush };
