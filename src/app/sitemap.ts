import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/posts";

const STATIC_ROUTES = [
  "",
  "/product",
  "/agency",
  "/pricing",
  "/resources",
  "/resources/blog",
  "/resources/guide",
  "/resources/docs",
  "/resources/changelog",
  "/enterprise",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/login",
  "/signup",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `https://ansaraeo.com${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.8,
  }));

  const blogEntries = POSTS.map((post) => ({
    url: `https://ansaraeo.com/resources/blog/${post.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
