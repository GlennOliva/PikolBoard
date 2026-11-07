import type { MetadataRoute } from "next";
import { productConfig } from "@/lib/product-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: productConfig.name,
    short_name: productConfig.shortName,
    description: productConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0B0B18",
    theme_color: "#0B0B18",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
