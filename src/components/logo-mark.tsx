// Cadence's mark: a record's grooves, opened on the right into a C, with the label in the
// middle. Accent-blue grooves and a deep-blue label; `inverse` makes it all white, for blue
// surfaces. Decorative: always sits next to the "Cadence" wordmark, which carries the name.
// Sized by its container (it fills it).
export function LogoMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="size-full" fill="none">
      <g
        stroke={inverse ? "#fff" : "var(--accent)"}
        strokeWidth={3}
        strokeLinecap="round"
      >
        <path d="M25.19 6.81 A13 13 0 1 0 25.19 25.19" />
        <path d="M22.01 9.99 A8.5 8.5 0 1 0 22.01 22.01" />
      </g>
      <circle
        cx={16}
        cy={16}
        r={3}
        fill={inverse ? "#fff" : "var(--accent-deep)"}
      />
    </svg>
  );
}
