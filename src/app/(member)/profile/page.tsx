import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

const ROLE_LABEL = { SUPER_ADMIN: "Super administrator", CHAPTER_ADMIN: "Chapter administrator", MEMBER: "Member" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">My profile</h1>
        <dl className="grid max-w-lg gap-x-6 gap-y-2 rounded-lg border bg-card p-4 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted-foreground">Chapter</dt>
          <dd>{user.chapterName}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>{ROLE_LABEL[user.role]}</dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          To change your name or chapter, contact your chapter administrator.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
