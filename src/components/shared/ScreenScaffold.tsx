import { cn } from "@/lib/utils";
import { ScreenHeader } from "./ScreenHeader";
import { ContentColumn, type ContentWidth } from "./content-width";

/**
 * Standard screen scaffold: sticky header + scrollable content with room for
 * the bottom navigation. Every screen composes this so spacing is uniform.
 *
 * Responsive: content centers in a width-classed column on md+ (see
 * content-width.tsx); mobile layout is unchanged.
 */
export function ScreenScaffold({
  title,
  subtitle,
  right,
  onBack,
  children,
  contentClassName,
  headerClassName,
  bare,
  width = "default",
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  bare?: boolean;
  width?: ContentWidth;
}) {
  if (bare) {
    return <div className={cn("flex h-full min-h-0 flex-col", contentClassName)}>{children}</div>;
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader
        title={title ?? ""}
        subtitle={subtitle}
        right={right}
        onBack={onBack}
        className={headerClassName}
        width={width}
      />
      <div
        className={cn(
          "scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-28 md:px-6 md:pb-12",
          contentClassName
        )}
      >
        <ContentColumn width={width}>{children}</ContentColumn>
      </div>
    </div>
  );
}
