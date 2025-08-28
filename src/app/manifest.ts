import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Millennial Reign App",
    short_name: "MR App",
    display: "standalone",
    start_url: "/",
    background_color: "#000000",
    theme_color: "#000000",
    description: "PWA with Supabase auth and offline support",
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
