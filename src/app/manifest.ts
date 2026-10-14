import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Unveiled",
    short_name: "Unveiled",
    description: "Celebrate the couple, capture the vibe, unveil the memories.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0a09",
    theme_color: "#0b0a09",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
