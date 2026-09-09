"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ClientApiError } from "@/lib/api-client";
import { SEA_TIMEZONES, utcToZonedInput, zonedInputToUtc } from "@/lib/dates";
import type { EventDto } from "@/server/services/events";

type Option = { id: string; name: string };

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(20000),
  hostChapterId: z.string().min(1, "Choose a chapter"),
  eventTypeId: z.string().min(1, "Choose a theme"),
  startLocal: z.string().min(1, "Start is required"),
  endLocal: z.string().min(1, "End is required"),
  timezone: z.string().min(1),
  venue: z.string().max(300),
  isOnline: z.boolean(),
  onlineUrl: z.string().max(2000),
  coverImageUrl: z.string().max(2000),
  visibility: z.enum(["LOCAL", "REGIONAL", "CHAPTER_SPECIFIC"]),
  accessChapterIds: z.array(z.string()),
  capacity: z.string(),
  regOpensLocal: z.string(),
  regClosesLocal: z.string(),
  paymentType: z.enum(["FREE", "PAID"]),
  price: z.string(),
  currency: z.string(),
  paymentInstructions: z.string().max(5000),
  paymentUrl: z.string().max(2000),
});
type FormValues = z.infer<typeof formSchema>;

type Props = {
  chapters: Option[];
  types: Option[];
  /** Chapter admins cannot change the host chapter. */
  lockedChapterId?: string;
  /** Pre-selected chapter for new events (the admin's own chapter). */
  defaultChapterId?: string;
  /** Present in edit mode. */
  event?: EventDto;
};

function toFormValues(event: EventDto | undefined, defaults: { chapterId: string; typeId: string }): FormValues {
  if (!event) {
    return {
      title: "",
      description: "",
      hostChapterId: defaults.chapterId,
      eventTypeId: defaults.typeId,
      startLocal: "",
      endLocal: "",
      timezone: "Asia/Singapore",
      venue: "",
      isOnline: false,
      onlineUrl: "",
      coverImageUrl: "",
      visibility: "REGIONAL",
      accessChapterIds: [],
      capacity: "",
      regOpensLocal: "",
      regClosesLocal: "",
      paymentType: "FREE",
      price: "",
      currency: "SGD",
      paymentInstructions: "",
      paymentUrl: "",
    };
  }
  const tz = event.timezone;
  return {
    title: event.title,
    description: event.description,
    hostChapterId: event.hostChapter.id,
    eventTypeId: event.eventType.id,
    startLocal: utcToZonedInput(new Date(event.startAt), tz),
    endLocal: utcToZonedInput(new Date(event.endAt), tz),
    timezone: tz,
    venue: event.venue,
    isOnline: event.isOnline,
    onlineUrl: event.onlineUrl ?? "",
    coverImageUrl: event.coverImageUrl ?? "",
    visibility: event.visibility,
    accessChapterIds: event.accessChapters.map((c) => c.id),
    capacity: event.capacity?.toString() ?? "",
    regOpensLocal: event.registrationOpensAt ? utcToZonedInput(new Date(event.registrationOpensAt), tz) : "",
    regClosesLocal: event.registrationClosesAt ? utcToZonedInput(new Date(event.registrationClosesAt), tz) : "",
    paymentType: event.paymentType,
    price: event.price?.toString() ?? "",
    currency: event.currency ?? "SGD",
    paymentInstructions: event.paymentInstructions ?? "",
    paymentUrl: event.paymentUrl ?? "",
  };
}

function toApiBody(v: FormValues) {
  const tz = v.timezone;
  const opt = (s: string) => (s ? zonedInputToUtc(s, tz).toISOString() : null);
  return {
    title: v.title,
    description: v.description,
    hostChapterId: v.hostChapterId,
    eventTypeId: v.eventTypeId,
    startAt: zonedInputToUtc(v.startLocal, tz).toISOString(),
    endAt: zonedInputToUtc(v.endLocal, tz).toISOString(),
    timezone: tz,
    venue: v.venue,
    isOnline: v.isOnline,
    onlineUrl: v.onlineUrl || null,
    coverImageUrl: v.coverImageUrl || null,
    visibility: v.visibility,
    accessChapterIds: v.visibility === "CHAPTER_SPECIFIC" ? v.accessChapterIds : [],
    capacity: v.capacity ? Number(v.capacity) : null,
    registrationOpensAt: opt(v.regOpensLocal),
    registrationClosesAt: opt(v.regClosesLocal),
    paymentType: v.paymentType,
    price: v.price ? Number(v.price) : null,
    currency: v.currency || null,
    paymentInstructions: v.paymentInstructions || null,
    paymentUrl: v.paymentUrl || null,
  };
}

const FIELD_MAP: Record<string, keyof FormValues> = {
  startAt: "startLocal",
  endAt: "endLocal",
  registrationOpensAt: "regOpensLocal",
  registrationClosesAt: "regClosesLocal",
};

export function EventForm({ chapters, types, lockedChapterId, defaultChapterId, event }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(event, {
      chapterId: lockedChapterId ?? defaultChapterId ?? chapters[0]?.id ?? "",
      typeId: types[0]?.id ?? "",
    }),
  });
  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = form;
  const visibility = watch("visibility");
  const paymentType = watch("paymentType");
  const isOnline = watch("isOnline");

  async function submit(values: FormValues, publish: boolean) {
    setServerError(null);
    try {
      const body = toApiBody(values);
      const saved = event
        ? await api<EventDto>(`/events/${event.id}`, { method: "PATCH", json: body })
        : await api<EventDto>("/events", { method: "POST", json: body });
      if (publish && saved.status === "DRAFT") await api(`/events/${saved.id}/publish`, { method: "POST" });
      router.push("/admin/events");
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError) {
        const fields = e.body.fields ?? {};
        for (const [k, msgs] of Object.entries(fields)) {
          const key = FIELD_MAP[k] ?? (k as keyof FormValues);
          if (key in values) setError(key, { message: msgs[0] });
        }
        setServerError(e.message);
      } else {
        setServerError("Could not save the event");
      }
    }
  }

  const err = (k: keyof FormValues) =>
    errors[k]?.message ? <p className="text-xs text-destructive">{String(errors[k]?.message)}</p> : null;

  return (
    <form className="max-w-3xl space-y-8" onSubmit={handleSubmit((v) => submit(v, false))}>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="space-y-1">
          <Label htmlFor="title">Event name</Label>
          <Input id="title" {...register("title")} />
          {err("title")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Theme</Label>
            <Controller
              control={control}
              name="eventTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {err("eventTypeId")}
          </div>
          <div className="space-y-1">
            <Label>Host chapter</Label>
            <Controller
              control={control}
              name="hostChapterId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(lockedChapterId)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    {chapters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {err("hostChapterId")}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Description (Markdown supported)</Label>
          <Textarea id="description" rows={8} {...register("description")} />
          {err("description")}
        </div>
        <div className="space-y-1">
          <Label htmlFor="coverImageUrl">Cover image URL (optional)</Label>
          <Input id="coverImageUrl" placeholder="https://…" {...register("coverImageUrl")} />
          {err("coverImageUrl")}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">When and where</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="startLocal">Starts</Label>
            <Input id="startLocal" type="datetime-local" {...register("startLocal")} />
            {err("startLocal")}
          </div>
          <div className="space-y-1">
            <Label htmlFor="endLocal">Ends</Label>
            <Input id="endLocal" type="datetime-local" {...register("endLocal")} />
            {err("endLocal")}
          </div>
          <div className="space-y-1">
            <Label>Timezone</Label>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEA_TIMEZONES.map((z) => (
                      <SelectItem key={z.value} value={z.value}>
                        {z.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isOnline"
            render={({ field }) => <Switch id="isOnline" checked={field.value} onCheckedChange={field.onChange} />}
          />
          <Label htmlFor="isOnline">Online event</Label>
        </div>
        {isOnline ? (
          <div className="space-y-1">
            <Label htmlFor="onlineUrl">Join link</Label>
            <Input id="onlineUrl" placeholder="https://zoom.us/…" {...register("onlineUrl")} />
            {err("onlineUrl")}
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" {...register("venue")} />
            {err("venue")}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Who can register</h2>
        <Controller
          control={control}
          name="visibility"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-2">
              {[
                ["REGIONAL", "Regional – any SEA member"],
                ["LOCAL", "Local – host chapter members only"],
                ["CHAPTER_SPECIFIC", "Chapter specific – choose chapters"],
              ].map(([v, l]) => (
                <div key={v} className="flex items-center gap-2">
                  <RadioGroupItem value={v} id={`vis-${v}`} />
                  <Label htmlFor={`vis-${v}`}>{l}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
        {visibility === "CHAPTER_SPECIFIC" && (
          <Controller
            control={control}
            name="accessChapterIds"
            render={({ field }) => (
              <div className="space-y-2 rounded-md border p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {chapters.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(c.id)}
                        onCheckedChange={(on) =>
                          field.onChange(on ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                {err("accessChapterIds")}
              </div>
            )}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="capacity">Capacity (blank = unlimited)</Label>
            <Input id="capacity" type="number" min={1} {...register("capacity")} />
            {err("capacity")}
          </div>
          <div className="space-y-1">
            <Label htmlFor="regOpensLocal">Registration opens (optional)</Label>
            <Input id="regOpensLocal" type="datetime-local" {...register("regOpensLocal")} />
            {err("regOpensLocal")}
          </div>
          <div className="space-y-1">
            <Label htmlFor="regClosesLocal">Registration closes (optional)</Label>
            <Input id="regClosesLocal" type="datetime-local" {...register("regClosesLocal")} />
            {err("regClosesLocal")}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Payment</h2>
        <Controller
          control={control}
          name="paymentType"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="FREE" id="pay-free" />
                <Label htmlFor="pay-free">Free</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="PAID" id="pay-paid" />
                <Label htmlFor="pay-paid">Paid</Label>
              </div>
            </RadioGroup>
          )}
        />
        {paymentType === "PAID" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="price">Price</Label>
                <Input id="price" type="number" min={0} step="0.01" {...register("price")} />
                {err("price")}
              </div>
              <div className="space-y-1">
                <Label htmlFor="currency">Currency (3 letters)</Label>
                <Input id="currency" maxLength={3} {...register("currency")} />
                {err("currency")}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentInstructions">Payment instructions</Label>
              <Textarea id="paymentInstructions" rows={3} {...register("paymentInstructions")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentUrl">Payment link (optional)</Label>
              <Input id="paymentUrl" placeholder="https://…" {...register("paymentUrl")} />
              {err("paymentUrl")}
            </div>
          </div>
        )}
      </section>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          {event ? "Save changes" : "Save as draft"}
        </Button>
        {(!event || event.status === "DRAFT") && (
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit((v) => submit(v, true))}>
            {event ? "Save and publish" : "Publish"}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
