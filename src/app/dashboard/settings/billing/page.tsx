import { createClient } from "@/lib/supabase/server";
import { PLAN_PRICING } from "@/lib/razorpay";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import CheckoutButton from "./CheckoutButton";

function inr(n: number) {
  return "\u20b9" + n.toLocaleString("en-IN");
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { success } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const { data: org } = await supabase
    .from("organizations")
    .select("plan, billing_provider")
    .eq("id", membership?.org_id)
    .single();

  const { data: payments } = await supabase
    .from("payments")
    .select("plan, billing_cycle, amount_inr, status, created_at")
    .eq("org_id", membership?.org_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const currentPlan = org?.plan ?? "trial";

  return (
    <div className="max-w-3xl">
      <PageHeader title="Billing" />

      {success === "1" && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
          Payment received — your plan will update within a few seconds once Razorpay confirms it. Refresh if it
          doesn&apos;t update immediately.
        </p>
      )}

      <Panel title="Current plan">
        <p className="text-xs font-medium text-muted">Current plan</p>
        <p className="mt-1 text-2xl font-bold capitalize">{currentPlan}</p>
      </Panel>

      <h2 className="mt-10 text-lg font-bold tracking-tight">Upgrade</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {Object.entries(PLAN_PRICING).map(([key, plan]) => (
          <div key={key} className="card flex flex-col p-6">
            <h3 className="font-bold">{plan.label}</h3>
            <p className="mt-2 text-2xl font-extrabold">
              {inr(plan.monthly)}
              <span className="text-sm font-normal text-muted">/mo</span>
            </p>
            <p className="text-xs text-muted">or {inr(plan.yearly)}/yr (2 months free)</p>
            <div className="mt-5">
              <CheckoutButton plan={key} cycle="monthly" label={plan.label} userEmail={user?.email ?? ""} />
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-bold tracking-tight">Payment history</h2>
      <Panel className="mt-4" bodyClassName="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p, i) => (
              <tr key={i} className="border-t border-line/60">
                <td className="px-5 py-3">{new Date(p.created_at).toLocaleDateString("en-IN")}</td>
                <td className="px-5 py-3 capitalize">{p.plan} ({p.billing_cycle})</td>
                <td className="px-5 py-3">{inr(p.amount_inr)}</td>
                <td className="px-5 py-3 capitalize">{p.status}</td>
              </tr>
            ))}
            {(!payments || payments.length === 0) && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-muted">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <p className="mt-6 text-xs text-muted">
        Need to cancel or have a billing issue? Email{" "}
        <a href="mailto:admin@ansaraeo.com" className="text-accent">admin@ansaraeo.com</a> — see our{" "}
        <a href="/refund-policy" className="text-accent">Refund Policy</a>.
      </p>
    </div>
  );
}
