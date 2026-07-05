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
  content: string[]; // array of paragraphs — rendered on the post detail page
};

export type AccountType = "brand" | "agency";
