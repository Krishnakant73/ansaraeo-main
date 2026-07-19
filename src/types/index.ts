export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  initials: string;
  date: string;
  readTime: string;
  featured?: boolean;
  thumb: string;
  content: string[]; // array of paragraphs — rendered on the post detail page. A line beginning with "## " renders as an <h2> section heading (AEO-friendly structure).
  keywords?: string[]; // SEO/AEO target keywords — emitted in <meta name="keywords">
  faqs?: { q: string; a: string }[]; // optional FAQ block — rendered on-page and emitted as FAQPage JSON-LD so answer engines can cite it directly
};

export type AccountType = "brand" | "agency";
