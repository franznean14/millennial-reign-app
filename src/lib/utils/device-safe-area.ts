"use client";

type SafeAreaInsets = {
  top: number;
};

const IOS_NOTCH_THRESHOLD = 44;

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isMacWithTouch =
    /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
  return isIOS || isMacWithTouch;
}

function measureSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === "undefined") return { top: 0 };
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.top = "0";
  probe.style.left = "0";
  probe.style.height = "0";
  probe.style.paddingTop = "env(safe-area-inset-top)";
  probe.style.paddingTop = "constant(safe-area-inset-top)";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const top = probe.offsetHeight || 0;
  document.body.removeChild(probe);
  return { top };
}

export function applyDeviceSafeAreaTop(): void {
  if (typeof document === "undefined") return;
  const { top } = measureSafeAreaInsets();
  const isIOS = isIOSDevice();
  const hasNotchOrIsland = isIOS && top >= IOS_NOTCH_THRESHOLD;
  const safeTop = hasNotchOrIsland ? top : 0;

  document.documentElement.style.setProperty("--device-safe-top", `${safeTop}px`);
  document.body.classList.toggle("has-device-safe-top", safeTop > 0);
  document.documentElement.setAttribute("data-has-iphone-notch", hasNotchOrIsland ? "true" : "false");
}
