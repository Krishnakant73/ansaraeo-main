// ============================================================
// Google Business Profile (GBP) audit (Batch 24)
//
// Local-SEO signal for Indian/local brands. Uses the Google Places API
// (New) to look up a business profile and classify it as claimed &
// maintained / claimed-partial / claimed-minimal / unclaimed, using the
// transparent signal heuristic from the GEO community (website set, owner
// photos, hours, editorial summary, reviews, specific category, photo count).
//
// GOOGLE_PLACES_API_KEY is OPTIONAL — the route returns a clear error when
// it's absent rather than failing silently.
// ============================================================

export type GbpResult = {
  found: boolean;
  statusLabel: "claimed_maintained" | "claimed_partial" | "claimed_minimal" | "unclaimed" | "not_found";
  statusEmoji: string;
  claimSignals: string[];
  maintenanceSignals: string[];
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  businessStatus?: string;
  primaryCategory?: string;
  rating?: number;
  reviewCount?: number;
  mapsUrl?: string;
  editorialSummary?: string;
  recentReview?: string;
  photoCount?: number;
};

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";

function classify(claim: string[], maint: string[]): { label: GbpResult["statusLabel"]; emoji: string } {
  if (claim.length >= 2 && maint.length >= 4) return { label: "claimed_maintained", emoji: "🟢" };
  if (claim.length >= 1 && maint.length >= 2) return { label: "claimed_partial", emoji: "🟡" };
  if (claim.length >= 1) return { label: "claimed_minimal", emoji: "🟠" };
  return { label: "unclaimed", emoji: "🔴" };
}

export async function auditGBP(businessName: string, location: string, apiKey: string): Promise<GbpResult> {
  const fieldMask =
    "places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri," +
    "places.nationalPhoneNumber,places.internationalPhoneNumber,places.businessStatus,places.primaryType," +
    "places.rating,places.userRatingCount,places.editorialSummary,places.reviews,places.photos," +
    "places.regularOpeningHours,places.types";

  // 1) Text Search to resolve the place id.
  const searchRes = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({ text: `${businessName} ${location}`.trim(), maxResultCount: 1 }),
  });
  if (!searchRes.ok) throw new Error(`Places Text Search failed: ${searchRes.status} ${await searchRes.text()}`);
  const searchData = await searchRes.json();
  const place = searchData.places?.[0];
  if (!place?.id) {
    return { found: false, statusLabel: "not_found", statusEmoji: "⚪", claimSignals: [], maintenanceSignals: [] };
  }

  // 2) Place Details.
  const detailsRes = await fetch(`${DETAILS_URL}${place.id}?fields=${fieldMask}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask },
  });
  if (!detailsRes.ok) throw new Error(`Places Details failed: ${detailsRes.status} ${await detailsRes.text()}`);
  const d = await detailsRes.json();

  const claim: string[] = [];
  const maint: string[] = [];

  if (d.websiteUri) claim.push("Website field set");
  const ownerPhotos = (d.photos ?? []).filter((p: { authorAttribution?: { displayName?: string } }) => {
    const n = p.authorAttribution?.displayName ?? "";
    return n.length > 0 && n !== "Google";
  });
  if (ownerPhotos.length > 0) {
    claim.push("Owner-uploaded photos");
    maint.push("Owner-uploaded photos");
  }
  if (d.regularOpeningHours) maint.push("Opening hours set");
  if (d.editorialSummary?.text || d.editorialSummary?.language) maint.push("Editorial summary present");
  if ((d.userRatingCount ?? 0) > 0) maint.push("Has reviews");
  const genericTypes = ["establishment", "point_of_interest", "services"];
  if (d.primaryType && !genericTypes.includes(d.primaryType)) maint.push("Industry-specific category");
  if ((d.photos ?? []).length >= 10) maint.push("≥10 photos");

  const { label, emoji } = classify(claim, maint);

  const review = (d.reviews ?? [])[0];
  const recentReview = review
    ? `${"★".repeat(Math.round(review.rating ?? 0))} ${review.text?.slice(0, 220) ?? ""}`.trim()
    : undefined;

  return {
    found: true,
    statusLabel: label,
    statusEmoji: emoji,
    claimSignals: claim,
    maintenanceSignals: maint,
    name: d.displayName?.text,
    address: d.formattedAddress,
    phone: d.internationalPhoneNumber || d.nationalPhoneNumber,
    website: d.websiteUri,
    businessStatus: d.businessStatus,
    primaryCategory: d.primaryType,
    rating: d.rating,
    reviewCount: d.userRatingCount,
    mapsUrl: d.googleMapsUri,
    editorialSummary: d.editorialSummary?.text,
    recentReview,
    photoCount: (d.photos ?? []).length,
  };
}
