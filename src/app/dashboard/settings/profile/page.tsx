import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div>
        <PageHeader title="Profile" subtitle="Your personal account details" />
        <p className="mt-6 text-sm text-muted">Sign in to view your profile.</p>
      </div>
    );
  }

  const email = user.email ?? "";
  const fullName = (user.user_metadata?.full_name as string) ?? "";

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your personal account details" />
      <div className="mt-6 max-w-xl">
        <ProfileForm email={email} initialName={fullName} />
      </div>
    </div>
  );
}
