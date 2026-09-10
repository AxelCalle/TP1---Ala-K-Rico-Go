interface LogoProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 36, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.25)}
      viewBox="0 0 160 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Silueta de llama — fondo transparente */}
      <path
        d="
          M80 8
          C84 18, 97 30, 92 48
          C103 33, 116 40, 110 60
          C122 50, 130 65, 120 82
          C132 90, 136 112, 124 132
          C130 150, 122 180, 80 186
          C38 180, 30 150, 36 132
          C24 112, 28 90, 40 82
          C30 65, 38 50, 50 60
          C44 40, 57 33, 68 48
          C63 30, 76 18, 80 8Z
        "
        fill="var(--flame)"
      />
      {/* Texto interior */}
      <text
        x="80"
        y="108"
        textAnchor="middle"
        fontFamily="'Bebas Neue', 'Arial Black', 'Arial', sans-serif"
        fontWeight="900"
        fontSize="30"
        fill="var(--coal)"
        letterSpacing="-0.5"
      >
        ALA
      </text>
      <text
        x="80"
        y="135"
        textAnchor="middle"
        fontFamily="'Bebas Neue', 'Arial Black', 'Arial', sans-serif"
        fontWeight="900"
        fontSize="26"
        fill="var(--coal)"
      >
        K&apos;
      </text>
      <text
        x="80"
        y="165"
        textAnchor="middle"
        fontFamily="'Bebas Neue', 'Arial Black', 'Arial', sans-serif"
        fontWeight="900"
        fontSize="30"
        fill="var(--coal)"
        letterSpacing="-0.5"
      >
        RICO
      </text>
    </svg>
  );
}
