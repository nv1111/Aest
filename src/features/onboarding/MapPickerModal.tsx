"use client";

/**
 * Map + manual-coordinate birth-place pickers (Phase 1.5 — real geocoding).
 * Map uses Leaflet + OpenStreetMap tiles: free, no API key, covers every
 * point on Earth — the universal fallback for villages missing from
 * GeoNames or users born outside the covered datasets. The nearest known
 * GeoNames place is resolved server-side for a readable label + the IANA
 * timezone (which the chart engine needs).
 *
 * State lives inside the dialog content, which Radix mounts only while
 * open — so every open starts fresh without reset effects.
 */

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Crosshair, Check, Loader2, Globe2 } from "lucide-react";
import { t } from "@/i18n";
import type { Place } from "@/lib/cities";
import "leaflet/dist/leaflet.css";

interface NearPlace extends Place {
  distanceKm: number;
}

async function fetchNear(lat: number, lng: number): Promise<NearPlace | null> {
  try {
    const res = await fetch(`/api/astrology/places/near?lat=${lat}&lng=${lng}`);
    const json = (await res.json()) as { ok: boolean; data?: { place: NearPlace | null } };
    if (json.ok && json.data) return json.data.place;
  } catch {
    // network hiccup — caller treats as "unknown"
  }
  return null;
}

/** Curated fallback when Intl.supportedValuesOf is unavailable. */
const TZ_FALLBACK = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "UTC",
];

function allTimezones(): string[] {
  try {
    const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof sv === "function") return sv("timeZone");
  } catch {
    // fall through
  }
  return TZ_FALLBACK;
}

// ---------------------------------------------------------------- map picker

export function MapPickerModal({
  open,
  onOpenChange,
  onSelect,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (place: Place) => void;
  initial?: Place | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("onboarding.mapPickerTitle")}</DialogTitle>
          <DialogDescription>{t("onboarding.mapPickerBody")}</DialogDescription>
        </DialogHeader>
        <MapInner
          initial={initial}
          onConfirm={(place) => {
            onSelect(place);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function MapInner({
  initial,
  onConfirm,
}: {
  initial?: Place | null;
  onConfirm: (place: Place) => void;
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const initialRef = useRef(initial);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [nearest, setNearest] = useState<NearPlace | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [tz, setTz] = useState<string>(initial?.timezone ?? "Asia/Kolkata");
  const [customName, setCustomName] = useState("");

  // Boot the Leaflet map on mount (dynamic import keeps it out of SSR).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapElRef.current) return;
      const start: [number, number] = initialRef.current
        ? [initialRef.current.latitude, initialRef.current.longitude]
        : [23.5, 80];
      const map = L.map(mapElRef.current, { zoomControl: true, attributionControl: true }).setView(
        start,
        initialRef.current ? 9 : 4,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      const pinIcon = L.divIcon({
        className: "",
        html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#e11d48;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);margin:-11px 0 0 -11px"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        setPin({ lat, lng });
        setNearest(null);
        setLookupDone(false);
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { icon: pinIcon, keyboard: false }).addTo(map);
        } else {
          (markerRef.current as { setLatLng: (p: [number, number]) => void }).setLatLng([lat, lng]);
        }
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      (mapRef.current as { remove: () => void } | null)?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Resolve the nearest known place (label + timezone) after a pin drop.
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const near = await fetchNear(pin.lat, pin.lng);
      if (cancelled) return;
      setNearest(near);
      setLookupDone(true);
      if (near) setTz(near.timezone);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pin]);

  const looking = pin !== null && !lookupDone;
  const kmAway = nearest
    ? nearest.distanceKm < 1
      ? nearest.distanceKm.toFixed(1)
      : Math.round(nearest.distanceKm)
    : null;

  const confirm = () => {
    if (!pin) return;
    onConfirm({
      name: customName.trim() || nearest?.name || t("onboarding.mapPinPlace"),
      country: nearest?.country ?? "",
      admin: nearest?.admin,
      latitude: pin.lat,
      longitude: pin.lng,
      timezone: tz,
    });
  };

  const timezones = allTimezones();

  return (
    <div className="space-y-3">
      <div
        ref={mapElRef}
        aria-label={t("onboarding.mapPickerTitle")}
        className="h-[46vh] min-h-[240px] w-full overflow-hidden rounded-2xl border bg-secondary"
      />

      {pin ? (
        <div className="space-y-3 rounded-2xl border bg-secondary/50 p-4">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
            <span className="font-mono">{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</span>
            {looking ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("onboarding.mapLooking")}
              </span>
            ) : nearest ? (
              <span className="truncate">
                · {t("onboarding.mapNear")}{" "}
                <span className="font-medium text-foreground">{nearest.name}</span>
                {nearest.admin ? `, ${nearest.admin}` : ""} ({kmAway} km)
              </span>
            ) : (
              <span>· {t("onboarding.mapRemote")}</span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pin-name" className="text-[12px] text-muted-foreground">
                {t("onboarding.mapNameLabel")}
              </Label>
              <Input
                id="pin-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={nearest?.name ?? t("onboarding.mapPinPlace")}
                className="h-10 rounded-xl"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-tz" className="text-[12px] text-muted-foreground">
                {t("onboarding.mapTzLabel")}
              </Label>
              <select
                id="pin-tz"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                aria-label={t("onboarding.mapTzLabel")}
                className="h-10 w-full rounded-xl border bg-background px-3 text-[14px] text-foreground"
              >
                {timezones.includes(tz) ? null : <option value={tz}>{tz}</option>}
                {timezones.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={confirm} className="h-11 w-full rounded-xl">
            <Check className="h-4 w-4" strokeWidth={2} />
            {t("onboarding.mapConfirm")}
          </Button>
        </div>
      ) : (
        <p className="text-center text-[13px] text-muted-foreground">{t("onboarding.mapHint")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------- manual coordinates

export function ManualCoordsModal({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (place: Place) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("onboarding.coordsTitle")}</DialogTitle>
          <DialogDescription>{t("onboarding.coordsBody")}</DialogDescription>
        </DialogHeader>
        <CoordsInner
          onConfirm={(place) => {
            onSelect(place);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CoordsInner({ onConfirm }: { onConfirm: (place: Place) => void }) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [name, setName] = useState("");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [touched, setTouched] = useState(false);
  const [near, setNear] = useState<NearPlace | null>(null);
  const [nearChecked, setNearChecked] = useState(false);

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const latOk = lat !== "" && Number.isFinite(latNum) && latNum >= -90 && latNum <= 90;
  const lngOk = lng !== "" && Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180;

  // Suggest a readable name + timezone from the nearest known place.
  useEffect(() => {
    if (!latOk || !lngOk) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const n = await fetchNear(latNum, lngNum);
      if (cancelled) return;
      setNear(n);
      setNearChecked(true);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lat, lng, latOk, lngOk, latNum, lngNum]);

  const save = () => {
    setTouched(true);
    if (!latOk || !lngOk) return;
    onConfirm({
      name: name.trim() || near?.name || t("onboarding.mapPinPlace"),
      country: near?.country ?? "",
      admin: near?.admin,
      latitude: latNum,
      longitude: lngNum,
      timezone: tz,
    });
  };

  const timezones = allTimezones();
  const showNear = latOk && lngOk && nearChecked;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="coord-lat" className="text-[12px] text-muted-foreground">
            {t("onboarding.coordsLat")}
          </Label>
          <Input
            id="coord-lat"
            inputMode="decimal"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              setNearChecked(false);
            }}
            placeholder="28.6139"
            className={`h-11 rounded-xl font-mono ${touched && !latOk ? "border-destructive" : ""}`}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="coord-lng" className="text-[12px] text-muted-foreground">
            {t("onboarding.coordsLng")}
          </Label>
          <Input
            id="coord-lng"
            inputMode="decimal"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              setNearChecked(false);
            }}
            placeholder="77.2090"
            className={`h-11 rounded-xl font-mono ${touched && !lngOk ? "border-destructive" : ""}`}
            autoComplete="off"
          />
        </div>
      </div>

      {showNear ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Globe2 className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
          <span className="truncate">
            {t("onboarding.mapNear")} <span className="font-medium text-foreground">{near?.name}</span>
            {near?.admin ? `, ${near.admin}` : ""}
            {near ? ` · ${near.timezone}` : ""}
          </span>
        </p>
      ) : latOk && lngOk ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("onboarding.mapLooking")}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="coord-name" className="text-[12px] text-muted-foreground">
          {t("onboarding.mapNameLabel")}
        </Label>
        <Input
          id="coord-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={near?.name ?? t("onboarding.coordsNamePlaceholder")}
          className="h-11 rounded-xl"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="coord-tz" className="text-[12px] text-muted-foreground">
          {t("onboarding.mapTzLabel")}
        </Label>
        <select
          id="coord-tz"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          aria-label={t("onboarding.mapTzLabel")}
          className="h-11 w-full rounded-xl border bg-background px-3 text-[14px] text-foreground"
        >
          {near && !timezones.includes(near.timezone) ? (
            <option value={near.timezone}>{near.timezone}</option>
          ) : null}
          {timezones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>

      <Button onClick={save} className="h-11 w-full rounded-xl">
        <Crosshair className="h-4 w-4" strokeWidth={2} />
        {t("onboarding.coordsSave")}
      </Button>
    </div>
  );
}
