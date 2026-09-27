"use client";

/**
 * Place search — resolves city/town/village, country, lat/lng, timezone.
 * The user never types coordinates. Used by onboarding, profile editing
 * and compatibility.
 *
 * Phase 1.5 — real geocoding: searches the self-hosted GeoNames table
 * (India full + world cities ≥ 500 population). When the place isn't in
 * the data, two universal fallbacks: drop a pin on the map (works for
 * any point on Earth) or enter coordinates manually.
 */

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Check, Map, Crosshair } from "lucide-react";
import { astrologyService } from "@/services/astrology";
import type { Place } from "@/lib/cities";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { MapPickerModal, ManualCoordsModal } from "./MapPickerModal";

export function PlaceSearch({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: Place | null;
  onChange: (place: Place) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [coordsOpen, setCoordsOpen] = useState(false);
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
  const showNoMatch = !isFetching && query.trim().length >= 3 && results.length === 0;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          value={open ? query : value ? `${value.name}${value.admin ? `, ${value.admin}` : ""}` : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={placeholder ?? t("onboarding.birthPlacePlaceholder")}
          aria-label={t("onboarding.birthPlace")}
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
              <div className="px-4 py-3 text-[13px] text-muted-foreground">{t("onboarding.mapLooking")}</div>
            ) : showNoMatch ? (
              <div className="px-4 py-3 text-[13px] text-muted-foreground">{t("onboarding.birthPlaceNotFound")}</div>
            ) : results.length === 0 ? null : (
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

          {/* Universal fallbacks — every place on Earth is reachable. */}
          <div className="grid grid-cols-2 gap-2 border-t bg-secondary/40 p-2.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setMapOpen(true);
              }}
              className="press flex flex-col gap-0.5 rounded-xl bg-background p-2.5 text-left hover:bg-secondary"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <Map className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                {t("onboarding.placeOnMap")}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">{t("onboarding.placeOnMapHint")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCoordsOpen(true);
              }}
              className="press flex flex-col gap-0.5 rounded-xl bg-background p-2.5 text-left hover:bg-secondary"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <Crosshair className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                {t("onboarding.placeManual")}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">{t("onboarding.placeManualHint")}</span>
            </button>
          </div>
        </div>
      ) : null}

      <MapPickerModal
        open={mapOpen}
        onOpenChange={setMapOpen}
        initial={value}
        onSelect={(place) => {
          onChange(place);
          setQuery("");
        }}
      />
      <ManualCoordsModal
        open={coordsOpen}
        onOpenChange={setCoordsOpen}
        onSelect={(place) => {
          onChange(place);
          setQuery("");
        }}
      />
    </div>
  );
}
