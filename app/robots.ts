import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms"],
        disallow: ["/dashboard", "/api", "/login"],
      },
    ],
    // Update this to your real domain before deploying
    sitemap: "https://paila.app/sitemap.xml",
  }
}
