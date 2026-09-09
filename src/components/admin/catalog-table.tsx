"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ClientApiError } from "@/lib/api-client";

export type Field = { name: string; label: string; type?: "text" | "color" | "number"; placeholder?: string };
export type CatalogRow = { id: string; isActive: boolean; usage: string } & Record<string, unknown>;

type Props = {
  title: string;
  singular: string;
  endpoint: string; // e.g. "/chapters"
  fields: Field[];
  rows: CatalogRow[];
  columns: { key: string; label: string; kind?: "text" | "color" }[];
};

function EntityDialog({
  open,
  onOpenChange,
  endpoint,
  fields,
  singular,
  row,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  endpoint: string;
  fields: Field[];
  singular: string;
  row?: CatalogRow;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, row ? String(row[f.name] ?? "") : ""])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const json: Record<string, unknown> = { ...values };
      for (const f of fields) if (f.type === "number") json[f.name] = Number(values[f.name] || 0);
      if (row) await api(`${endpoint}/${row.id}`, { method: "PATCH", json });
      else await api(endpoint, { method: "POST", json });
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
            <DialogTitle>
              {row ? "Edit" : "Add"} {singular}
            </DialogTitle>
          </DialogHeader>
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={f.name}>{f.label}</Label>
              <div className="flex items-center gap-2">
                {f.type === "color" && (
                  <input
                    type="color"
                    aria-label={`${f.label} picker`}
                    value={/^#[0-9a-fA-F]{6}$/.test(values[f.name]) ? values[f.name] : "#2563eb"}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                )}
                <Input
                  id={f.name}
                  type={f.type === "number" ? "number" : "text"}
                  placeholder={f.placeholder}
                  value={values[f.name]}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  required={f.type !== "number"}
                />
              </div>
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActiveSwitch({ endpoint, row }: { endpoint: string; row: CatalogRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Switch
      checked={row.isActive}
      disabled={busy}
      aria-label="Active"
      onCheckedChange={async (v) => {
        setBusy(true);
        try {
          await api(`${endpoint}/${row.id}`, { method: "PATCH", json: { isActive: v } });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

export function CatalogTable({ title, singular, endpoint, fields, rows, columns }: Props) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Button onClick={() => setAdding(true)}>Add {singular}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead>In use</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={r.isActive ? undefined : "opacity-60"}>
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    {c.kind === "color" ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: String(r[c.key]) }} />
                        {String(r[c.key] ?? "")}
                      </span>
                    ) : (
                      String(r[c.key] ?? "")
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-sm text-muted-foreground">{r.usage}</TableCell>
                <TableCell>
                  <ActiveSwitch endpoint={endpoint} row={r} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 3} className="py-8 text-center text-muted-foreground">
                  Nothing here yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {adding && <EntityDialog open onOpenChange={setAdding} endpoint={endpoint} fields={fields} singular={singular} />}
      {editing && (
        <EntityDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          endpoint={endpoint}
          fields={fields}
          singular={singular}
          row={editing}
        />
      )}
    </div>
  );
}
