import { SetPasswordForm } from "@/components/auth/set-password-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <SetPasswordForm
      title="Welcome"
      description="Choose a password to activate your account."
      endpoint="/auth/accept-invite"
      token={token}
      successPath="/events"
      submitLabel="Activate account"
    />
  );
}
