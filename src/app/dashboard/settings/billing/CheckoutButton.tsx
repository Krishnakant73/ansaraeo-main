"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function CheckoutButton({
  plan,
  cycle,
  label,
  userEmail,
}: {
  plan: string;
  cycle: "monthly" | "yearly";
  label: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    const res = await fetch("/api/billing/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, cycle }),
    });
    const order = await res.json();
    setLoading(false);

    if (!res.ok) {
      alert(order.error ?? "Could not start checkout. Please try again.");
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "AnsarAEO",
      description: `${label} plan — ${cycle}`,
      prefill: { email: userEmail },
      theme: { color: "#D66A38" },
      handler: function () {
        // IMPORTANT: this only means Razorpay's popup completed — the
        // actual plan upgrade happens via the verified webhook
        // (/api/billing/webhook), which may take a few seconds. We just
        // refresh the page here; the webhook will have updated the DB
        // by the time the page reloads in almost all cases.
        router.push("/dashboard/settings/billing?success=1");
        router.refresh();
      },
    });
    rzp.open();
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button onClick={handleClick} disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? "Preparing checkout…" : `Upgrade to ${label}`}
      </button>
    </>
  );
}
