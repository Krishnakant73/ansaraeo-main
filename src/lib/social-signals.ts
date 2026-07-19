import { getInternalLLM } from "@/lib/llm";

// ============================================================
// Brand Signals — social listening (Batch 25)
//
// AI answer engines lean heavily on community + video sources: research
// shows YouTube and Reddit are among the most-cited domains in AI answers.
// This module surfaces where a brand is being discussed on those platforms
// so the brand can seed / earn the mentions that later become AI citations.
//
//   • Reddit  — public search JSON endpoint, NO API key required.
//   • YouTube — optional, uses YOUTUBE_API_KEY; skips cleanly if absent.
//
// Sentiment is a cheap gpt-4o-mini classification pass over the collected
// titles/snippets (same honesty rule as the rest of the app — grounded in
// the real fetched text, and it degrades to "neutral" if OpenAI is absent).
// ============================================================

export type SocialMention = {
  source: "reddit" | "youtube";
  title: string;
  url: string;
  snippet: string;
  subredditOrChannel: string;
  score: number; // upvotes (reddit) or view count (youtube)
  createdAt: string | null;
};

export type SocialSignals = {
  brandName: string;
  reddit: { available: boolean; mentions: SocialMention[]; note?: string };
  youtube: { available: boolean; mentions: SocialMention[]; note?: string };
  sentiment: { positive: number; neutral: number; negative: number };
  totalMentions: number;
};

async function getRedditMentions(brandName: string): Promise<{ available: boolean; mentions: SocialMention[]; note?: string }> {
  try {
    const q = encodeURIComponent(`"${brandName}"`);
    const res = await fetch(`https://www.reddit.com/search.json?q=${q}&sort=new&limit=25&type=link`, {
      headers: { "User-Agent": "AnsarAEO-SignalsBot/1.0 (by /u/ansaraeo)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { available: false, mentions: [], note: `Reddit returned ${res.status} (rate-limited or blocked). Try again shortly.` };
    }
    const data = await res.json();
    const children = data?.data?.children ?? [];
    const mentions: SocialMention[] = children
      .map((c: { data?: Record<string, unknown> }) => c.data ?? {})
      .filter((d: Record<string, unknown>) => typeof d.title === "string")
      .map((d: Record<string, unknown>) => ({
        source: "reddit" as const,
        title: String(d.title),
        url: `https://www.reddit.com${String(d.permalink ?? "")}`,
        snippet: String(d.selftext ?? "").slice(0, 240),
        subredditOrChannel: `r/${String(d.subreddit ?? "")}`,
        score: Number(d.score ?? 0),
        createdAt: d.created_utc ? new Date(Number(d.created_utc) * 1000).toISOString() : null,
      }));
    return { available: true, mentions };
  } catch {
    return { available: false, mentions: [], note: "Could not reach Reddit (network/timeout)." };
  }
}

async function getYouTubeMentions(brandName: string): Promise<{ available: boolean; mentions: SocialMention[]; note?: string }> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return { available: false, mentions: [], note: "YouTube signals disabled — set YOUTUBE_API_KEY to enable." };
  }
  try {
    const q = encodeURIComponent(brandName);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=15&q=${q}&key=${key}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      return { available: false, mentions: [], note: `YouTube API returned ${res.status}. Check the key/quota.` };
    }
    const data = await res.json();
    const items = data?.items ?? [];
    const mentions: SocialMention[] = items
      .filter((it: { id?: { videoId?: string }; snippet?: unknown }) => it?.id?.videoId)
      .map((it: { id: { videoId: string }; snippet: Record<string, unknown> }) => ({
        source: "youtube" as const,
        title: String(it.snippet?.title ?? ""),
        url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
        snippet: String(it.snippet?.description ?? "").slice(0, 240),
        subredditOrChannel: String(it.snippet?.channelTitle ?? ""),
        score: 0,
        createdAt: (it.snippet?.publishedAt as string) ?? null,
      }));
    return { available: true, mentions };
  } catch {
    return { available: false, mentions: [], note: "Could not reach the YouTube API (network/timeout)." };
  }
}

// One cheap classification pass. Returns per-bucket counts. Degrades to all
// "neutral" when OPENAI_API_KEY is missing rather than throwing.
async function classifySentiment(
  brandName: string,
  mentions: SocialMention[]
): Promise<{ positive: number; neutral: number; negative: number }> {
  const base = { positive: 0, neutral: 0, negative: 0 };
  if (mentions.length === 0 || !process.env.OPENAI_API_KEY) {
    base.neutral = mentions.length;
    return base;
  }
  const numbered = mentions.map((m, i) => `${i + 1}. ${m.title} — ${m.snippet}`).join("\n").slice(0, 6000);
  try {
    const raw = await getInternalLLM().generate({
      system: `Classify the sentiment of each numbered social post TOWARD the brand "${brandName}". Respond ONLY as JSON: {"results": [{"n": number, "sentiment": "positive"|"neutral"|"negative"}]}. If a post doesn't clearly praise or criticize the brand, use "neutral".`,
      prompt: numbered,
      json: true,
    });
    const parsed = JSON.parse(raw ?? "{}");
    for (const r of parsed.results ?? []) {
      if (r.sentiment === "positive") base.positive += 1;
      else if (r.sentiment === "negative") base.negative += 1;
      else base.neutral += 1;
    }
    const counted = base.positive + base.neutral + base.negative;
    if (counted < mentions.length) base.neutral += mentions.length - counted;
    return base;
  } catch {
    base.neutral = mentions.length;
    return base;
  }
}

export async function getSocialSignals(brandName: string): Promise<SocialSignals> {
  const [reddit, youtube] = await Promise.all([getRedditMentions(brandName), getYouTubeMentions(brandName)]);
  const allMentions = [...reddit.mentions, ...youtube.mentions];
  const sentiment = await classifySentiment(brandName, allMentions);
  return {
    brandName,
    reddit,
    youtube,
    sentiment,
    totalMentions: allMentions.length,
  };
}
