import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import WhatsAppConnect from "./WhatsAppConnect";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase.from("org_members").select("org_id").eq("user_id", user!.id).limit(1).single();
  const { data: org } = await supabase
    .from("organizations")
    .select("whatsapp_number, whatsapp_verified")
    .eq("id", membership?.org_id)
    .single();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Integrations"
        subtitle="Connect the channels where you want alerts and approval requests."
      />
      <div className="mt-6 space-y-4">
        <Panel title="WhatsApp">
          <WhatsAppConnect currentNumber={org?.whatsapp_number ?? null} verified={org?.whatsapp_verified ?? false} />
        </Panel>
      </div>
    </div>
  );
}
