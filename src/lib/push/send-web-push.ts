import { ensureWebPushVapidConfigured, webpush } from "@/lib/push/vapid";

export type WebPushPayload = {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export async function sendWebPushToSubscriptions(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: WebPushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureWebPushVapidConfigured() || subscriptions.length === 0) {
    return { sent: 0, failed: subscriptions.length };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag ?? "default",
    data: payload.data ?? {},
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error("Failed to send push to subscription:", sub.id, error);
      }
    })
  );

  return { sent, failed };
}
