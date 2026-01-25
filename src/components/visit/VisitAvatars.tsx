"use client";

import { useState, useEffect } from "react";
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
  const [publisherImageLoaded, setPublisherImageLoaded] = useState(false);
  const [partnerImageLoaded, setPartnerImageLoaded] = useState(false);

  if (!publisher) return null;

  const publisherName = getPublisherName(publisher);

  // Check if images are already loaded (cached) and set fallback timeout
  useEffect(() => {
    if (publisher?.avatar_url) {
      // Check if image is already loaded
      const img = new window.Image();
      img.onload = () => setPublisherImageLoaded(true);
      img.onerror = () => setPublisherImageLoaded(true);
      img.src = publisher.avatar_url;
      
      // Fallback timeout to prevent stuck loading state
      const timeout = setTimeout(() => {
        setPublisherImageLoaded(true);
      }, 2000);
      
      return () => {
        img.onload = null;
        img.onerror = null;
        clearTimeout(timeout);
      };
    } else {
      setPublisherImageLoaded(true); // No image URL, show initials immediately
    }
  }, [publisher?.avatar_url]);

  useEffect(() => {
    if (partner?.avatar_url) {
      // Check if image is already loaded
      const img = new window.Image();
      img.onload = () => setPartnerImageLoaded(true);
      img.onerror = () => setPartnerImageLoaded(true);
      img.src = partner.avatar_url;
      
      // Fallback timeout to prevent stuck loading state
      const timeout = setTimeout(() => {
        setPartnerImageLoaded(true);
      }, 2000);
      
      return () => {
        img.onload = null;
        img.onerror = null;
        clearTimeout(timeout);
      };
    }
  }, [partner?.avatar_url]);

  const handlePublisherLoad = () => {
    setPublisherImageLoaded(true);
  };

  const handlePublisherError = () => {
    setPublisherImageLoaded(true);
  };

  const handlePartnerLoad = () => {
    setPartnerImageLoaded(true);
  };

  const handlePartnerError = () => {
    setPartnerImageLoaded(true);
  };

  return (
    <>
      {publisher.avatar_url ? (
        <>
          {!publisherImageLoaded && (
            <div
              className={cn(
                "rounded-full bg-muted/60 blur-[2px] animate-pulse",
                sizeClassName
              )}
            />
          )}
          <Image
            src={publisher.avatar_url}
            alt={publisherName}
            width={24}
            height={24}
            className={cn(
              "rounded-full object-cover",
              sizeClassName,
              !publisherImageLoaded && "hidden"
            )}
            onLoad={handlePublisherLoad}
            onError={handlePublisherError}
            loading="lazy"
            unoptimized
          />
        </>
      ) : (
        <div
          className={cn(
            "rounded-full bg-gray-600 flex items-center justify-center text-white",
            sizeClassName,
            textClassName
          )}
        >
          {getInitials(publisherName)}
        </div>
      )}
      {partner && (
        partner.avatar_url ? (
          <>
            {!partnerImageLoaded && (
              <div
                className={cn(
                  "rounded-full bg-muted/60 blur-[2px] animate-pulse -ml-2",
                  sizeClassName
                )}
              />
            )}
            <Image
              src={partner.avatar_url}
              alt={`${partner.first_name} ${partner.last_name}`}
              width={24}
              height={24}
              className={cn(
                "rounded-full object-cover -ml-2",
                sizeClassName,
                !partnerImageLoaded && "hidden"
              )}
              onLoad={handlePartnerLoad}
              onError={handlePartnerError}
              loading="lazy"
              unoptimized
            />
          </>
        ) : null
      )}
    </>
  );
}
