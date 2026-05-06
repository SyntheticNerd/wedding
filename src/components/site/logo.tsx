import { cn } from "@/lib/utils";
import { COUPLE } from "@/lib/site-config";

type LogoSize = "sm" | "md" | "lg" | "xl";

const sizeClass: Record<LogoSize, string> = {
  sm: "text-3xl",
  md: "text-4xl sm:text-5xl",
  lg: "text-6xl sm:text-7xl",
  xl: "text-7xl sm:text-8xl",
};

interface MarkProps {
  size?: LogoSize;
  className?: string;
}

/**
 * AJ monogram only — used in headers and as the favicon source-of-truth.
 * 32% deep-tuck overlap, blush J with synthetic bold via -webkit-text-stroke
 * to fake the B4 weight Ephesis doesn't ship.
 */
export function LogoMark({ size = "md", className }: MarkProps) {
  return (
    <span
      aria-label={`${COUPLE.groom} ${COUPLE.joiner} ${COUPLE.bride}`}
      className={cn(
        "inline-block whitespace-nowrap leading-none text-charcoal",
        sizeClass[size],
        className,
      )}
      style={{ fontFamily: "var(--font-script), cursive" }}
    >
      <span>A</span>
      <span
        className="text-blush"
        style={{
          marginLeft: "-0.32em",
          paintOrder: "stroke fill",
          WebkitTextStroke: "0.06em var(--blush, #B5614F)",
        }}
      >
        J
      </span>
    </span>
  );
}

interface LogoProps extends MarkProps {
  /** Render the full "Andrew & Jewel" wordmark below the mark. */
  withWordmark?: boolean;
}

export function Logo({ size = "md", withWordmark, className }: LogoProps) {
  if (!withWordmark) return <LogoMark size={size} className={className} />;

  return (
    <span className={cn("inline-flex flex-col items-center gap-1", className)}>
      <LogoMark size={size} />
      <span className="font-heading text-sm tracking-[0.3em] uppercase text-charcoal/70">
        {COUPLE.groom} {COUPLE.joiner} {COUPLE.bride}
      </span>
    </span>
  );
}
