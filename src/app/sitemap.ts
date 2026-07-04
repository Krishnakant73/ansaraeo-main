import type { MetadataRoute } from "next";

const ROUTES = ["", "/product", "/agency", "/pricing", "/resources", "/enterprise", "/terms", "/login", "/signup"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `https://ansaraeo.com${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
