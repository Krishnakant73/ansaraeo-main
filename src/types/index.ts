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
};

export type AccountType = "brand" | "agency";
