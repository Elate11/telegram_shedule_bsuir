import React, { useId } from 'react';

export interface BsuirLogoSvgProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Crisp scalable vector BSUIR emblem matching bsuir_logo.png (465x251).
 * Uses `fill="currentColor"` so any theme or splash color tints cleanly.
 */
export const BsuirLogoSvg: React.FC<BsuirLogoSvgProps> = ({
  size,
  width,
  height,
  className,
  ...rest
}) => {
  const maskId = useId();
  const resolvedWidth = width ?? size ?? 168;
  const resolvedHeight =
    height ?? (typeof resolvedWidth === 'number' ? Math.round((resolvedWidth * 251) / 465) : undefined);

  return (
    <svg
      viewBox="0 0 465 251"
      width={resolvedWidth}
      height={resolvedHeight}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="BSUIR Logo"
      role="img"
      {...rest}
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="465" height="251" fill="white" />
          {/* Diagonal 45-deg white cuts carving Pillar 2 & Pillar 3 intersections */}
          <path
            d="M 214 236 L 328 122 L 341 135 L 227 249 Z"
            fill="black"
          />
          <path
            d="M 291 236 L 405 122 L 418 135 L 304 249 Z"
            fill="black"
          />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>
        {/* Left 45-deg mast diagonal from (7, 241) to apex (258, 4) */}
        <path d="M 7 241 L 244 10 C 252 2 266 4 270 15 L 245 34 L 24 241 Z" />

        {/* Tall central pillar (Pillar 2): x=240..279, y=4..250 */}
        <rect x="240" y="4" width="39" height="246" rx="19.5" />

        {/* Pillar 1: x=164..203, y=107..250 with top-left diagonal hook */}
        <rect x="164" y="107" width="39" height="143" rx="19.5" />
        <path d="M 136 144 L 169 111 L 182 124 L 136 169 Z" />

        {/* Connecting diagonal ribbon 1 (Pillar 1 bottom -> Pillar 3 top) */}
        <path d="M 190 247 L 323 114 L 346 137 L 213 249 Z" />

        {/* Pillar 3: x=315..355, y=107..250 */}
        <rect x="315" y="107" width="40" height="143" rx="19.5" />

        {/* Connecting diagonal ribbon 2 (Pillar 3 bottom -> Pillar 4 top) */}
        <path d="M 342 247 L 400 114 L 423 137 L 365 249 Z" />

        {/* Pillar 4: x=392..431, y=107..250 with bottom-right diagonal hook */}
        <rect x="392" y="107" width="39" height="143" rx="19.5" />
        <path d="M 417 244 L 459 202 L 446 189 L 412 223 Z" />
      </g>

      {/* Three radio-wave crescents at top-right */}
      {[0, 32, 64].map((dx) => (
        <path
          key={dx}
          transform={`translate(${dx}, 0)`}
          d="M 319 10 C 319 8 322 7 325 8 C 340 12 350 26 350 43 C 350 60 340 74 325 78 C 322 79 319 78 319 76 C 319 74 322 73 324 72 C 334 68 340 56 340 43 C 340 30 334 18 324 14 C 322 13 319 12 319 10 Z"
        />
      ))}
    </svg>
  );
};

export default BsuirLogoSvg;
