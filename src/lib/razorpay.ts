import Razorpay from "razorpay";

// Server-only Razorpay instance. Never import this into a client component —
// key_secret must never reach the browser.
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const PLAN_PRICING: Record<
  string,
  { monthly: number; yearly: number; label: string }
> = {
  starter: { monthly: 2499, yearly: 24990, label: "Starter" },
  growth: { monthly: 7999, yearly: 79990, label: "Growth" },
  agency: { monthly: 14999, yearly: 149990, label: "Agency" },
};
