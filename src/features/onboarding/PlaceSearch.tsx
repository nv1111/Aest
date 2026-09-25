"use client";

/**
 * Place search — resolves city, country, lat/lng, timezone. The user never
 * sees coordinates. Used by onboarding and profile editing.
 */

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Check } from "lucide-react";
import { astrologyService } from "@/services/astrology";
import type { Place } from "@/lib/cities";
import { Input } from "@/components/ui/input";

export function PlaceSearch({
  value,
  onChange,
  placeholder = "Search city…",
  autoFocus,
}: {
  value: Place | null;
  onChange: (place: Place) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["places", query],
    queryFn: () => astrologyService.places(query),
    staleTime: Infinity,
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = data?.places ?? [];

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          value={open ? query : value ? `${value.name}, ${value.country}` : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={placeholder}
          aria-label="Birth place search"
          className="h-12 rounded-2xl pl-10 pr-4 text-[15px]"
          autoComplete="off"
        />
        {value && !open ? (
          <Check className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
        ) : null}
      </div>

      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border bg-popover shadow-lg">
          <div className="scroll-thin max-h-64 overflow-y-auto">
            {isFetching && results.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-muted-foreground">Searching…</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-muted-foreground">
                No match found — try the nearest big city
              </div>
            ) : (
              results.map((p) => (
                <button
                  key={`${p.name}-${p.latitude}`}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-foreground">{p.name}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {p.admin ? `${p.admin}, ` : ""}
                      {p.country}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
