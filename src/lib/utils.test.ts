import { describe, it, expect } from "vitest";
import { cn } from "./utils";
import { POSTS, CATEGORIES } from "./posts";

describe("Utility cn function", () => {
  it("merges class names correctly", () => {
    expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("handles falsy and conditional values", () => {
    expect(cn("bg-red-500", null, undefined, false && "text-white")).toBe("bg-red-500");
  });
});

describe("Posts and Categories data", () => {
  it("contains correct category categories", () => {
    expect(CATEGORIES).toContain("SEO");
    expect(CATEGORIES).toContain("AI");
  });

  it("has featured posts structured correctly", () => {
    const featured = POSTS.filter(p => p.featured);
    expect(featured.length).toBeGreaterThan(0);
    featured.forEach(post => {
      expect(post.slug).toBeDefined();
      expect(post.title).toBeDefined();
      expect(post.excerpt).toBeDefined();
    });
  });
});
