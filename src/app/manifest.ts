import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Accounts360 - Financial Accounting & FBR POS",
    short_name: "Accounts360",
    description: "Enterprise Financial Accounting, Multi-Company Ledger & FBR Digital POS Integration",
    start_url: "/",
    display: "standalone",
    background_color: "#0B1120",
    theme_color: "#0B1120",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
