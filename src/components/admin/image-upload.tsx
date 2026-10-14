"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientApiError } from "@/lib/api-client";

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** "cover" renders a wide preview, "avatar" a small round one. */
  variant?: "cover" | "avatar";
  label?: string;
};

async function upload(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/v1/uploads", { method: "POST", body: form, credentials: "same-origin" });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientApiError(res.status, payload.error ?? { code: "UNKNOWN", message: "Upload failed" });
  return payload.data.url as string;
}

export function ImageUpload({ value, onChange, variant = "cover", label = "Upload image" }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await upload(file));
    } catch (err) {
      setError(err instanceof ClientApiError ? (err.body.fields?.file?.[0] ?? err.message) : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const preview =
    variant === "cover" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value} alt="" className="h-40 w-full rounded-md border object-cover" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value} alt="" className="h-16 w-16 rounded-full border object-cover" />
    );

  return (
    <div className={variant === "cover" ? "space-y-2" : "flex items-center gap-3"}>
      {value ? (
        preview
      ) : variant === "avatar" ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed text-muted-foreground">
          <ImagePlus className="h-5 w-5" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onFile} />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1 h-4 w-4" />}
          {value ? "Replace" : label}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <X className="mr-1 h-4 w-4" /> Remove
          </Button>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      {variant === "cover" && !value && (
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF up to 8 MB. Large images are resized automatically.</p>
      )}
    </div>
  );
}
