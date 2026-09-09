"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api, ClientApiError } from "@/lib/api-client";
import type { Attendee } from "@/server/services/registrations";

type Props = { rows: Attendee[]; paid: boolean; emptyText: string };

function PaymentCell({ row }: { row: Attendee }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <Select
        value={row.paymentStatus}
        disabled={busy}
        onValueChange={async (v) => {
          setBusy(true);
          setError(null);
          try {
            await api(`/registrations/${row.id}`, { method: "PATCH", json: { paymentStatus: v } });
            router.refresh();
          } catch (e) {
            setError(e instanceof ClientApiError ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="PAID">Paid</SelectItem>
          <SelectItem value="NOT_REQUIRED">Not required</SelectItem>
        </SelectContent>
      </Select>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function RegistrationsTable({ rows, paid, emptyText }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Chapter</TableHead>
            <TableHead>Registered</TableHead>
            {paid && <TableHead>Payment</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={paid ? 6 : 5} className="py-6 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => (
            <TableRow key={r.id}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium">{r.user.name}</TableCell>
              <TableCell>{r.user.email}</TableCell>
              <TableCell>{r.user.chapterName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(r.registeredAt).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" })}
              </TableCell>
              {paid && (
                <TableCell>
                  {r.status === "CANCELLED" ? (
                    <Badge variant="outline">{r.paymentStatus.toLowerCase()}</Badge>
                  ) : (
                    <PaymentCell row={r} />
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
