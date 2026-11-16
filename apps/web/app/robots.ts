import type { MetadataRoute } from "next";
import { isProductionSite } from "../lib/site.ts";

export default function robots(): MetadataRoute.Robots {
  return isProductionSite()
    ? { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] } }
    : { rules: { userAgent: "*", disallow: "/" } };
}
