"use client";

import Image from "next/image";
import { getInitials, getPublisherName } from "@/lib/utils/visit-history-ui";
import { cn } from "@/lib/utils";

interface VisitAvatarsProps {
  publisher?: { first_name: string; last_name: string; avatar_url?: string } | null;
  partner?: { first_name: string; last_name: string; avatar_url?: string } | null;
  sizeClassName?: string;
  textClassName?: string;
}

export function VisitAvatars({
  publisher,
  partner,
  sizeClassName = "w-6 h-6",
  textClassName = "text-[10px]"
}: VisitAvatarsProps) {
  if (!publisher) return null;

  const publisherName = getPublisherName(publisher);

  return (
    <>
      {publisher.avatar_url ? (
        <Image
          src={publisher.avatar_url}
          alt={publisherName}
          width={24}
          height={24}
          className={cn("rounded-full object-cover ring-2 ring-background", sizeClassName)}
        />
      ) : (
        <div
          className={cn(
            "rounded-full bg-gray-600 flex items-center justify-center text-white ring-2 ring-background",
            sizeClassName,
            textClassName
          )}
        >
          {getInitials(publisherName)}
        </div>
      )}
      {partner && (
        <Image
          src={partner.avatar_url || ""}
          alt={`${partner.first_name} ${partner.last_name}`}
          width={24}
          height={24}
          className={cn("rounded-full object-cover ring-2 ring-background -ml-2", sizeClassName)}
        />
      )}
    </>
  );
}
