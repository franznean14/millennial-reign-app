"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitialsFromName, getPublisherName } from "@/lib/utils/visit-history-ui";
import { cn } from "@/lib/utils";

interface VisitAvatarsProps {
  publisher?: { first_name: string; last_name: string; avatar_url?: string } | null;
  partner?: { first_name: string; last_name: string; avatar_url?: string } | null;
  publisherGuestName?: string | null;
  partnerGuestName?: string | null;
  sizeClassName?: string;
  textClassName?: string;
}

export function VisitAvatars({
  publisher,
  partner,
  publisherGuestName,
  partnerGuestName,
  sizeClassName = "w-6 h-6",
  textClassName = "text-[10px]"
}: VisitAvatarsProps) {
  const hasFirst = !!publisher || !!publisherGuestName?.trim();
  const hasSecond = !!partner || !!partnerGuestName?.trim();

  if (!hasFirst) return null;

  const hasPublisherName = (p: typeof publisher) =>
    p && `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim().length > 0;
  const firstDisplayName = hasPublisherName(publisher)
    ? getPublisherName(publisher!)
    : (publisherGuestName ?? "").trim();
  const secondDisplayName = hasPublisherName(partner)
    ? getPublisherName(partner!)
    : (partnerGuestName ?? "").trim();
  const firstInitials = getInitialsFromName(firstDisplayName || "?");
  const secondInitials = getInitialsFromName(secondDisplayName || "?");
  const firstIsGuest = !hasPublisherName(publisher) && !!publisherGuestName?.trim();
  const secondIsGuest = !hasPublisherName(partner) && !!partnerGuestName?.trim();
  const guestFallbackClass =
    "bg-amber-500/25 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 ring-1 ring-amber-500/50 dark:ring-amber-400/40";
  const defaultFallbackClass = "bg-muted text-muted-foreground";

  return (
    <>
      <Avatar className={cn("rounded-full shrink-0", sizeClassName)}>
        {publisher?.avatar_url && (
          <AvatarImage src={publisher.avatar_url} alt={firstDisplayName} className="object-cover" />
        )}
        <AvatarFallback
          className={cn(textClassName, firstIsGuest ? guestFallbackClass : defaultFallbackClass)}
        >
          {firstInitials}
        </AvatarFallback>
      </Avatar>
      {hasSecond && (
        <Avatar className={cn("rounded-full shrink-0 -ml-2 border-2 border-background", sizeClassName)}>
          {partner?.avatar_url && (
            <AvatarImage src={partner.avatar_url} alt={secondDisplayName} className="object-cover" />
          )}
          <AvatarFallback
            className={cn(textClassName, secondIsGuest ? guestFallbackClass : defaultFallbackClass)}
          >
            {secondInitials}
          </AvatarFallback>
        </Avatar>
      )}
    </>
  );
}
