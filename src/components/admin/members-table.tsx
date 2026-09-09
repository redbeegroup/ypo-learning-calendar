"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ClientApiError } from "@/lib/api-client";
import type { AdminUser } from "@/server/services/users";

type Option = { id: string; name: string };
type Role = AdminUser["role"];

type Props = {
  users: AdminUser[];
  chapters: Option[];
  actor: { id: string; role: Role; chapterId: string };
};

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  CHAPTER_ADMIN: "Chapter admin",
  MEMBER: "Member",
};

function StatusBadge({ user }: { user: AdminUser }) {
  if (user.status === "ACTIVE") return <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>;
  if (user.status === "DISABLED") return <Badge variant="destructive">Disabled</Badge>;
  return <Badge variant="secondary">{user.inviteExpired ? "Invite expired" : "Invited"}</Badge>;
}

type FormState = { email: string; name: string; chapterId: string; role: Role };

function UserDialog({
  open,
  onOpenChange,
  chapters,
  actor,
  user,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  chapters: Option[];
  actor: Props["actor"];
  user?: AdminUser;
}) {
  const router = useRouter();
  const isSuper = actor.role === "SUPER_ADMIN";
  const [form, setForm] = useState<FormState>({
    email: user?.email ?? "",
    name: user?.name ?? "",
    chapterId: user?.chapterId ?? actor.chapterId,
    role: user?.role ?? "MEMBER",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await api(`/users/${user.id}`, {
          method: "PATCH",
          json: { name: form.name, chapterId: form.chapterId, role: form.role },
        });
      } else {
        await api("/users", { method: "POST", json: form });
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        const first = err.body.fields ? Object.values(err.body.fields)[0]?.[0] : undefined;
        setError(first ?? err.message);
      } else setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{user ? "Edit member" : "Invite member"}</DialogTitle>
            <DialogDescription>
              {user ? "Update the member's details." : "They will receive an email with a link to set their password."}
            </DialogDescription>
          </DialogHeader>
          {!user && (
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Chapter</Label>
            <Select value={form.chapterId} onValueChange={(v) => setForm({ ...form, chapterId: v })} disabled={!isSuper}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as Role })}
              disabled={!isSuper || user?.id === actor.id}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Member</SelectItem>
                <SelectItem value="CHAPTER_ADMIN">Chapter admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : user ? "Save" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RowActions({ user, chapters, actor }: { user: AdminUser; chapters: Option[]; actor: Props["actor"] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canManage = actor.role === "SUPER_ADMIN" || (actor.chapterId === user.chapterId && user.role === "MEMBER");
  if (!canManage) return null;

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg(done);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ClientApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
        Edit
      </Button>
      {user.status === "INVITED" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run(() => api(`/users/${user.id}/resend-invite`, { method: "POST" }), "Invite sent")}
        >
          Resend invite
        </Button>
      )}
      {user.id !== actor.id &&
        (user.status === "DISABLED" ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => api(`/users/${user.id}`, { method: "PATCH", json: { status: "ACTIVE" } }))}
          >
            Enable
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => run(() => api(`/users/${user.id}`, { method: "PATCH", json: { status: "DISABLED" } }))}
          >
            Disable
          </Button>
        ))}
      {edit && <UserDialog open={edit} onOpenChange={setEdit} chapters={chapters} actor={actor} user={user} />}
    </div>
  );
}

export function MembersTable({ users, chapters, actor }: Props) {
  const [invite, setInvite] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setInvite(true)}>Invite member</Button>
        {invite && <UserDialog open={invite} onOpenChange={setInvite} chapters={chapters} actor={actor} />}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id} className={u.status === "DISABLED" ? "opacity-60" : undefined}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.chapterName}</TableCell>
                <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                <TableCell>
                  <StatusBadge user={u} />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions user={u} chapters={chapters} actor={actor} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
