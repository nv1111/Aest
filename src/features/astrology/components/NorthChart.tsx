"use client";

import { SIGNS, type PlanetName, type SignName } from "@/lib/astrology/types";
import { PLANET_ABBR } from "../constants";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * North Indian (diamond) kundli — pure inline SVG, no clip-art.
 * Square + both diagonals + midpoint diamond = 12 fixed house regions.
 * Houses are numbered 1–12 (circled); each shows its rashi (sign) number
 * and planet abbreviations. Tap a house to inspect it.
 *
 * Geometry (viewBox 0 0 400 400, square 10..390):
 *   diagonals  (10,10)-(390,390) and (390,10)-(10,390)
 *   diamond    (200,10)-(390,200)-(200,390)-(10,200)
 */

interface ChartHouse {
  house: number;
  sign: SignName;
  planets: PlanetName[];
}

/** One region per house (1–12), counter-clockwise from top-centre. */
const HOUSE_POLYGON: Record<number, string> = {
  1: "200,10 295,105 200,200 105,105",
  2: "10,10 200,10 105,105",
  3: "10,10 10,200 105,105",
  4: "10,200 105,105 200,200 105,295",
  5: "10,200 10,390 105,295",
  6: "10,390 200,390 105,295",
  7: "200,390 105,295 200,200 295,295",
  8: "200,390 390,390 295,295",
  9: "390,390 390,200 295,295",
  10: "390,200 295,295 200,200 295,105",
  11: "390,200 390,10 295,105",
  12: "390,10 200,10 295,105",
};

/** Hand-tuned label anchors: [houseNum x, y, signNum x, y, planets cx, cy]. */
const HOUSE_LABELS: Record<number, [number, number, number, number, number, number]> = {
  1: [200, 28, 200, 190, 200, 105],
  2: [42, 32, 150, 32, 105, 62],
  3: [31, 55, 31, 78, 57, 107],
  4: [31, 190, 31, 212, 102, 200],
  5: [31, 322, 31, 346, 57, 295],
  6: [42, 378, 150, 378, 105, 338],
  7: [200, 374, 200, 215, 200, 295],
  8: [358, 378, 250, 378, 295, 338],
  9: [369, 322, 369, 346, 343, 295],
  10: [369, 190, 369, 212, 298, 200],
  11: [369, 55, 369, 78, 343, 107],
  12: [358, 32, 250, 32, 295, 62],
};

const ROW_HEIGHT = 17;

/** Corner triangles have far less room than the four big diamond houses. */
const SMALL_HOUSES = new Set([2, 3, 5, 6, 8, 9, 11, 12]);

export function NorthChart({
  houses,
  retroPlanets,
  activeHouse,
  onSelectHouse,
}: {
  houses: ChartHouse[];
  retroPlanets: Set<PlanetName>;
  activeHouse: number | null;
  onSelectHouse: (house: number) => void;
}) {
  const byHouse = new Map(houses.map((h) => [h.house, h]));

  return (
    <svg
      viewBox="0 0 400 400"
      width="100%"
      role="group"
      aria-label="North Indian birth chart, 12 houses"
      className="block h-auto w-full select-none md:mx-auto md:max-w-[560px]"
    >
      {/* ------------------------------------------------ interactive house regions */}
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
        const house = byHouse.get(n);
        const sign = house?.sign;
        const planets = house?.planets ?? [];
        const signNumber = sign ? SIGNS.indexOf(sign) + 1 : null;
        const label = t("astrology.houseTitle", { n }) + (sign ? ` — ${sign}` : "");
        return (
          <polygon
            key={n}
            points={HOUSE_POLYGON[n]}
            role="button"
            tabIndex={0}
            aria-label={label}
            onClick={() => onSelectHouse(n)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectHouse(n);
              }
            }}
            cursor="pointer"
            className={cn(
              "outline-none transition-[fill] duration-150",
              activeHouse === n
                ? "fill-accent"
                : "fill-transparent hover:fill-accent/40 focus-visible:fill-accent/60"
            )}
          />
        );
      })}

      {/* ------------------------------------------------ chart lines */}
      <g pointerEvents="none" strokeLinecap="round">
        <rect x="10" y="10" width="380" height="380" fill="none" className="stroke-border" strokeWidth="2" rx="4" />
        <line x1="10" y1="10" x2="390" y2="390" className="stroke-border" strokeWidth="1.5" />
        <line x1="390" y1="10" x2="10" y2="390" className="stroke-border" strokeWidth="1.5" />
        <polygon
          points="200,10 390,200 200,390 10,200"
          fill="none"
          className="stroke-border"
          strokeWidth="1.5"
        />
      </g>

      {/* ------------------------------------------------ labels */}
      <g pointerEvents="none">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
          const [hx, hy, sx, sy, pcx, pcy] = HOUSE_LABELS[n];
          const house = byHouse.get(n);
          const planets = house?.planets ?? [];
          const signNumber = house ? SIGNS.indexOf(house.sign) + 1 : null;

          // planet rows: big diamond houses stack up to 3 solo then pair;
          // corner triangles pair early — stacked rows overflow the small region
          const perRow = SMALL_HOUSES.has(n) ? (planets.length <= 2 ? 1 : 2) : planets.length <= 3 ? 1 : 2;
          const rows: PlanetName[][] = [];
          for (let i = 0; i < planets.length; i += perRow) {
            rows.push(planets.slice(i, i + perRow));
          }
          const fontSize = planets.length > 6 ? 10.5 : SMALL_HOUSES.has(n) ? 11.5 : 12.5;

          return (
            <g key={`label-${n}`}>
              {/* house number — circled */}
              <circle cx={hx} cy={hy} r="7" className="fill-secondary stroke-hairline" strokeWidth="1" />
              <text
                x={hx}
                y={hy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="8.5"
                fontWeight="600"
                className="fill-muted-foreground"
              >
                {n}
              </text>
              {/* rashi (sign) number — small, muted */}
              {signNumber !== null ? (
                <text
                  x={sx}
                  y={sy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="500"
                  className="fill-muted-foreground"
                >
                  {signNumber}
                </text>
              ) : null}
              {/* planets */}
              {rows.map((row, r) => {
                const y = pcy + (r - (rows.length - 1) / 2) * ROW_HEIGHT;
                return (
                  <text
                    key={`p-${n}-${r}`}
                    x={pcx}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={fontSize}
                    fontWeight="600"
                    className="fill-foreground"
                  >
                    {row.map((p, idx) => {
                      const retro = retroPlanets.has(p);
                      return (
                        <tspan key={p}>
                          {idx > 0 ? "  " : ""}
                          {PLANET_ABBR[p]}
                          {retro ? (
                            <tspan fontSize={fontSize - 3.5} className="fill-warning">
                              {" R"}
                            </tspan>
                          ) : null}
                        </tspan>
                      );
                    })}
                  </text>
                );
              })}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
