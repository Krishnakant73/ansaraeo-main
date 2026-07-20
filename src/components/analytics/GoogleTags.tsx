// GoogleTags — GA4 gtag.js + GTM injection via next/script.
//
// Using next/script (not raw <script> tags) matters in the App Router:
//   - It defers execution to the correct point in the page lifecycle
//     ("afterInteractive"), keeping first paint fast.
//   - It de-duplicates automatically — even if this component renders in
//     multiple layouts, Next only loads each script once.
//
// Both trackers are env-gated. If NEXT_PUBLIC_GA_ID or NEXT_PUBLIC_GTM_ID
// is unset, that half becomes a no-op — no request, no console noise.
//
// The <noscript> GTM iframe belongs at the very top of <body>, per Google's
// docs. That's exported separately as GtmNoscript so RootLayout can slot it
// in the right place.

import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export function GoogleTagsHead() {
  return (
    <>
      {GTM_ID && (
        <Script
          id="gtm-init"
          strategy="afterInteractive"
          // GTM's own recommended snippet, verbatim, with the ID interpolated.
          // Kept as a string so gtag() shims initialize before the SDK loads.
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
      )}
      {GA_ID && (
        <>
          <Script
            id="ga-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
          <Script
            id="ga-init"
            strategy="afterInteractive"
            // gtag('js') MUST be the first call after the shim is defined.
            // 'config' with the measurement ID auto-sends a page_view.
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`,
            }}
          />
        </>
      )}
    </>
  );
}

// Rendered as the first child of <body> so it works when JS is disabled.
export function GtmNoscript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
