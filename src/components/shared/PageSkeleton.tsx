import { Skeleton } from "@/components/ui/skeleton";

/** Standard content skeleton — list/card variants keep loading states calm. */
export function PageSkeleton({ variant = "cards" }: { variant?: "cards" | "list" | "chart" }) {
  if (variant === "list") {
    return (
      <div className="space-y-3 px-4 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (variant === "chart") {
    return (
      <div className="space-y-4 px-4 pt-2">
        <Skeleton className="aspect-square w-full max-w-[340px] mx-auto rounded-3xl" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4 px-4 pt-2">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
