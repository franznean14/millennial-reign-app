import { useEffect, useState } from "react";

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(!!mq?.matches);
    
    update();
    mq?.addEventListener?.("change", update);
    
    return () => mq?.removeEventListener?.("change", update);
  }, []);

  return isMobile;
}
