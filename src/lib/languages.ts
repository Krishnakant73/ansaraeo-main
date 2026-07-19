// Single source of truth for the Indian languages AnsarAEO supports.
// English is included because it's the default; the rest are the 22
// scheduled languages of the Indian Constitution. The `brands.languages`
// column is `text[]` (no enum), so adding a code here needs no migration.

export type Language = { code: string; name: string; native: string };

export const INDIAN_LANGUAGES: Language[] = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
  { code: "kok", name: "Konkani", native: "कोंकणी" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "sd", name: "Sindhi", native: "سنڌي" },
  { code: "ks", name: "Kashmiri", native: "کٲشُر" },
  { code: "doi", name: "Dogri", native: "डोगरी" },
  { code: "mni", name: "Manipuri", native: "মৈতৈলোন্" },
  { code: "brx", name: "Bodo", native: "बड़ो" },
  { code: "sat", name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
];

const BY_CODE = new Map(INDIAN_LANGUAGES.map((l) => [l.code, l]));

export function languageName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

export function languageNative(code: string): string {
  return BY_CODE.get(code)?.native ?? code;
}
