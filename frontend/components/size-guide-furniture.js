export function SizeGuideDimensionDiagram({ width, height }) {
  const artW = Number(width);
  const artH = Number(height);
  const aspect = artW > 0 && artH > 0 ? artW / artH : 0.75;
  const boxW = aspect >= 1 ? 78 : Math.max(36, 78 * aspect);
  const boxH = aspect >= 1 ? Math.max(36, 78 / aspect) : 78;
  const pad = 22;
  const depth = 10;

  return (
    <svg
      viewBox={`0 0 ${boxW + pad * 2 + depth} ${boxH + pad * 2 + depth}`}
      className="h-[5.5rem] w-[6.5rem]"
      aria-hidden="true"
    >
      <path
        d={`M${pad + depth} ${pad} H${pad + depth + boxW} L${pad + boxW} ${pad + depth} H${pad} Z`}
        fill="#efe8dc"
        stroke="#a38a5e"
        strokeWidth="1"
      />
      <rect
        x={pad}
        y={pad + depth}
        width={boxW}
        height={boxH}
        fill="#f7f1e8"
        stroke="#2c2e26"
        strokeWidth="1.2"
      />
      <path
        d={`M${pad + boxW} ${pad + depth} L${pad + depth + boxW} ${pad} V${pad + boxH} L${pad + boxW} ${pad + depth + boxH} Z`}
        fill="#e4d8c4"
        stroke="#a38a5e"
        strokeWidth="1"
      />
      <text x={pad + boxW / 2} y={pad + depth + boxH + 14} textAnchor="middle" fill="#78746f" fontSize="8" fontFamily="Manrope, sans-serif">
        Width
      </text>
      <text
        x={10}
        y={pad + depth + boxH / 2}
        textAnchor="middle"
        fill="#78746f"
        fontSize="8"
        fontFamily="Manrope, sans-serif"
        transform={`rotate(-90 10 ${pad + depth + boxH / 2})`}
      >
        Height
      </text>
      <text x={pad + boxW + 2} y={pad + 8} fill="#a38a5e" fontSize="8" fontFamily="Manrope, sans-serif">
        Depth
      </text>
    </svg>
  );
}
