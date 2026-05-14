type Props = {
  className?: string;
  /** Tone: 'light' for use over gradient/dark hero, 'tinted' for use over light page */
  tone?: "light" | "tinted";
  height?: string;
};

/** Three-layer animated SVG water waves. Place inside a `relative` parent. */
export function WaterWaves({ className = "", tone = "light", height = "h-32" }: Props) {
  const colors =
    tone === "light"
      ? ["rgba(255,255,255,0.18)", "rgba(186,230,253,0.28)", "rgba(34,211,238,0.38)"]
      : ["oklch(0.78 0.12 220 / 0.18)", "oklch(0.7 0.14 215 / 0.22)", "oklch(0.58 0.16 230 / 0.28)"];

  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 overflow-hidden ${height} ${className}`}>
      <svg
        className="absolute bottom-0 left-0 h-full w-[200%] animate-[wave_12s_linear_infinite]"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0,40 C150,90 300,0 600,40 C900,80 1050,20 1200,50 L1200,120 L0,120 Z"
          fill={colors[0]}
        />
      </svg>
      <svg
        className="absolute bottom-0 left-0 h-full w-[200%] animate-[wave_8s_linear_infinite_reverse]"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0,60 C200,20 400,100 600,60 C800,20 1000,90 1200,50 L1200,120 L0,120 Z"
          fill={colors[1]}
        />
      </svg>
      <svg
        className="absolute bottom-0 left-0 h-full w-[200%] animate-[wave_6s_linear_infinite]"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0,70 C150,30 350,110 600,70 C850,30 1050,100 1200,70 L1200,120 L0,120 Z"
          fill={colors[2]}
        />
      </svg>
    </div>
  );
}
