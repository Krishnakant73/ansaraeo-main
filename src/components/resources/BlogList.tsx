"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES, POSTS } from "@/lib/posts";
import { cn } from "@/lib/utils";

export default function BlogList() {
  const [category, setCategory] = useState("All");

  const filtered = useMemo(
    () => (category === "All" ? POSTS : POSTS.filter((p) => p.category === category)),
    [category]
  );

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200",
              category === c
                ? "border-accent bg-accent text-white"
                : "border-line text-muted hover:border-ink/30 hover:text-ink"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((post) => (
          <Link key={post.slug} href={`/resources/blog/${post.slug}`} className="card group flex flex-col p-6">
            <div className={`h-28 w-full rounded-xl bg-gradient-to-br ${post.thumb}`} />
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-accent">{post.category}</p>
            <h3 className="mt-1.5 text-base font-bold leading-snug tracking-tight group-hover:text-accent">
              {post.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{post.excerpt}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-grid text-[10px] font-bold">
                {post.initials}
              </span>
              {post.author} · {post.date} · {post.readTime}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-16 text-center text-sm text-muted">No posts in this category yet.</p>
        )}
      </div>
    </div>
  );
}
