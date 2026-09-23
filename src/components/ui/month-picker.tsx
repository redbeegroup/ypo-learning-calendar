"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Props = {
  /** "YYYY-MM" or empty. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Lower bound "YYYY-MM" (inclusive), e.g. the chosen "from" month for the "to" picker. */
  min?: string;
  /** Upper bound "YYYY-MM" (inclusive). */
  max?: string;
  className?: string;
};

export function formatMonth(value: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function MonthPicker({ value, onChange, placeholder = "Pick month", min, max, className }: Props) {
  const [open, setOpen] = useState(false);
  const selectedYear = value ? Number(value.slice(0, 4)) : new Date().getFullYear();
  const [year, setYear] = useState(selectedYear);

  const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const disabled = (k: string) => (min !== undefined && k < min) || (max !== undefined && k > max);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(selectedYear);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 justify-start font-normal", !value && "text-muted-foreground", className)}>
          <CalendarDays className="mr-2 h-4 w-4 opacity-60" />
          {value ? formatMonth(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((label, i) => {
            const k = key(year, i);
            const active = k === value;
            return (
              <Button
                key={k}
                variant={active ? "default" : "ghost"}
                size="sm"
                className="h-8"
                disabled={disabled(k)}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
              >
                {label}
              </Button>
            );
          })}
        </div>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-muted-foreground"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <X className="mr-1 h-3 w-3" /> Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
