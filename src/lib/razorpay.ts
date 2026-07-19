import Razorpay from "razorpay";

// Server-only Razorpay instance. Never import this into a client component —
// key_secret must never reach the browser.
//
// FIX (found via a real `next build` failure): the client used to be
// created eagerly at module load time (`export const razorpay = new
// Razorpay(...)`). Next.js evaluates API route modules during its build-
// time "page data collection" step, which meant `next build` itself
// failed with "key_id or oauthToken is mandatory" any time
// RAZORPAY_KEY_ID/SECRET weren't present in the build environment — for
// example in a CI pipeline before secrets are configured. Lazy-
// initializing via a function called only when actually handling a
// request fixes this: the build no longer needs live payment credentials
// just to compile.
let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _razorpay;
}

export const PLAN_PRICING: Record<
  string,
  { monthly: number; yearly: number; label: string }
> = {
  starter: { monthly: 2499, yearly: 24990, label: "Starter" },
  growth: { monthly: 7999, yearly: 79990, label: "Growth" },
  agency: { monthly: 14999, yearly: 149990, label: "Agency" },
};
