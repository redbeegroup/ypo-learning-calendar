import { SetPasswordForm } from "@/components/auth/set-password-form";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <SetPasswordForm
      title="Reset password"
      description="Choose a new password for your account."
      endpoint="/auth/reset-password"
      token={token}
      successPath="/login"
      submitLabel="Reset password"
    />
  );
}
