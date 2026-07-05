import type { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "AnsarAEO's refund and cancellation policy.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="container-x prose prose-sm max-w-3xl py-32 md:py-40">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Refund & Cancellation Policy</h1>
        <p className="text-sm text-muted">Last updated: July 2026</p>

        <p>
          We built this policy to be genuinely transparent — no dark patterns, no hidden conditions. This is one
          of the ways we intend to do better than other tools in this category.
        </p>

        <h2>1. Free Trial</h2>
        <p>
          New accounts get a 14-day free trial. No card is required to start a trial, and no charge occurs unless
          you actively choose to subscribe to a paid plan.
        </p>

        <h2>2. Cancellation</h2>
        <p>
          You can cancel your subscription at any time from Settings &gt; Billing, with one click. Cancellation
          takes effect at the end of your current billing period — you keep access until then, and you will not
          be charged again afterward.
        </p>

        <h2>3. Refunds</h2>
        <ul>
          <li><strong>Monthly plans:</strong> we do not provide prorated refunds for partial months, but you will
            not be billed again after cancellation.</li>
          <li><strong>Annual plans:</strong> if you cancel within the first 14 days of an annual purchase, you are
            eligible for a full refund. After 14 days, refunds are considered on a case-by-case basis (e.g.,
            genuine service issues on our end).</li>
          <li><strong>Billing errors:</strong> if you believe you were charged incorrectly (duplicate charge,
            charge after cancellation, etc.), email us and we will investigate and refund confirmed errors
            promptly.</li>
        </ul>

        <h2>4. How to Request a Refund</h2>
        <p>
          Email <a href="mailto:admin@ansaraeo.com">admin@ansaraeo.com</a> with your account email and the reason
          for the request. We aim to respond within 2 business days.
        </p>

        <h2>5. Card Removal</h2>
        <p>
          You can remove your saved payment method at any time from Settings &gt; Billing. If you experience any
          issue removing a card, contact us immediately — this is treated as a priority issue on our end.
        </p>
      </main>
      <Footer />
    </>
  );
}
