import Razorpay from "razorpay";

// Server-only Razorpay instance. Never import this into a client component —
// key_secret must never reach the browser.
// Lazy-initialised so the build doesn't crash when env vars are absent.
let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
    }
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
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
