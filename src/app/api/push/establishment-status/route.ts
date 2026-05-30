import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  buildRackStatusNotificationMessage,
  getNewlyAddedRackStatuses,
  userWantsPushNotifications,
  type RackPushStatus,
} from "@/lib/push/establishment-status";
import { buildEstablishmentPushDeepLinkPath } from "@/lib/push/deep-link";
import { sendWebPushToSubscriptions } from "@/lib/push/send-web-push";

type RequestBody = {
  establishmentId: string;
  previousStatuses?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const establishmentId = body?.establishmentId;
    if (!establishmentId || typeof establishmentId !== "string") {
      return NextResponse.json({ error: "establishmentId is required" }, { status: 400 });
    }

    const { data: actorProfile, error: profileError } = await supabase
      .from("profiles")
      .select("congregation_id, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (profileError || !actorProfile?.congregation_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    const service = createSupabaseServiceClient();
    const { data: establishment, error: estError } = await service
      .from("business_establishments")
      .select("id, name, area, statuses, congregation_id, is_deleted, is_archived")
      .eq("id", establishmentId)
      .single();

    if (estError || !establishment) {
      return NextResponse.json({ error: "Establishment not found" }, { status: 404 });
    }

    if (
      establishment.congregation_id !== actorProfile.congregation_id ||
      establishment.is_deleted ||
      establishment.is_archived
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const addedStatuses = getNewlyAddedRackStatuses(
      body.previousStatuses,
      establishment.statuses as string[] | null
    );

    if (addedStatuses.length === 0) {
      return NextResponse.json({ success: true, sent: 0, skipped: "no_new_rack_statuses" });
    }

    const { data: congregationProfiles, error: membersError } = await service
      .from("profiles")
      .select("id, notification_preferences")
      .eq("congregation_id", actorProfile.congregation_id)
      .neq("id", user.id);

    if (membersError) {
      return NextResponse.json({ error: "Failed to load congregation members" }, { status: 500 });
    }

    const recipientIds = (congregationProfiles ?? [])
      .filter((p) => userWantsPushNotifications(p.notification_preferences as Record<string, unknown>))
      .map((p) => p.id);

    if (recipientIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0, recipients: 0 });
    }

    const { data: subscriptions, error: subError } = await service
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);

    if (subError) {
      return NextResponse.json({ error: "Failed to load push subscriptions" }, { status: 500 });
    }

    if (!subscriptions?.length) {
      return NextResponse.json({ success: true, sent: 0, recipients: recipientIds.length });
    }

    const actorName = [actorProfile.first_name, actorProfile.last_name].filter(Boolean).join(" ").trim();
    let totalSent = 0;
    let totalFailed = 0;

    for (const status of addedStatuses) {
      const { title, body: notifBody } = buildRackStatusNotificationMessage(
        status as RackPushStatus,
        establishment.name,
        establishment.area
      );

      const result = await sendWebPushToSubscriptions(subscriptions, {
        title,
        body: notifBody,
        tag: `establishment-${establishmentId}-${status}`,
        data: {
          url: buildEstablishmentPushDeepLinkPath(establishmentId),
          establishmentId,
          status,
          updatedBy: user.id,
          updatedByName: actorName || undefined,
        },
      });
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return NextResponse.json({
      success: true,
      sent: totalSent,
      failed: totalFailed,
      statuses: addedStatuses,
      recipients: recipientIds.length,
      subscriptions: subscriptions.length,
    });
  } catch (error) {
    console.error("Establishment status push error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
