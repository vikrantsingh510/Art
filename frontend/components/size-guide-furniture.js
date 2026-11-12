function Svg({ viewBox, children, label }) {
  return (
    <svg
      viewBox={viewBox}
      className="h-full w-full"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
    >
      {children}
    </svg>
  );
}

export function SizeGuideSofa() {
  return (
    <Svg viewBox="0 0 220 85" label="Typical three-seat sofa">
      <ellipse cx="110" cy="81.5" rx="98" ry="3.2" fill="#c4b8a4" opacity="0.55" />
      <path d="M24 76.5h6v5.5c0 .8-.7 1.5-1.5 1.5h-3c-.8 0-1.5-.7-1.5-1.5z" fill="#5e4d32" />
      <path d="M64 76.5h6v5.5c0 .8-.7 1.5-1.5 1.5h-3c-.8 0-1.5-.7-1.5-1.5z" fill="#5e4d32" />
      <path d="M150 76.5h6v5.5c0 .8-.7 1.5-1.5 1.5h-3c-.8 0-1.5-.7-1.5-1.5z" fill="#5e4d32" />
      <path d="M190 76.5h6v5.5c0 .8-.7 1.5-1.5 1.5h-3c-.8 0-1.5-.7-1.5-1.5z" fill="#5e4d32" />
      <path d="M16 40c0-4 3-8 9-10 8-3 18-6 28-6h114c10 0 20 3 28 6 6 2 9 6 9 10v36H16V40z" fill="#7a7468" />
      <path d="M20 38c2-9 12-16 24-16h132c12 0 22 7 24 16v8H20v-8z" fill="#8d8779" />
      <path d="M16 42c0-8 6-14 16-16v46H22c-3.3 0-6-2.7-6-6V42z" fill="#6f6a5e" />
      <path d="M188 26c10 2 16 8 16 16v24c0 3.3-2.7 6-6 6h-10V26z" fill="#6f6a5e" />
      <path d="M22 34c4-6 10-9 16-9h8v22c-8 0-16-3-22-8v-5z" fill="#9a9486" />
      <path d="M174 25h8c6 0 12 3 16 9v5c-6 5-14 8-22 8V25z" fill="#9a9486" />
      <rect x="38" y="46" width="144" height="30" fill="#6a655a" />
      <path d="M40 48h44c1.2 0 2 1 2 2.2v22.6c0 1.2-.8 2.2-2 2.2H40c-1.2 0-2-1-2-2.2V50.2c0-1.2.8-2.2 2-2.2z" fill="#a39c8d" />
      <path d="M88 48h44c1.2 0 2 1 2 2.2v22.6c0 1.2-.8 2.2-2 2.2H88c-1.2 0-2-1-2-2.2V50.2c0-1.2.8-2.2 2-2.2z" fill="#aaa394" />
      <path d="M136 48h44c1.2 0 2 1 2 2.2v22.6c0 1.2-.8 2.2-2 2.2h-44c-1.2 0-2-1-2-2.2V50.2c0-1.2.8-2.2 2-2.2z" fill="#a39c8d" />
      <path d="M40 22h44c1.4 0 2.4 1.1 2.4 2.4v20.2H37.6V24.4c0-1.3 1-2.4 2.4-2.4z" fill="#918b7d" />
      <path d="M88 22h44c1.4 0 2.4 1.1 2.4 2.4v20.2H85.6V24.4c0-1.3 1-2.4 2.4-2.4z" fill="#9a9486" />
      <path d="M136 22h44c1.4 0 2.4 1.1 2.4 2.4v20.2h-48.8V24.4c0-1.3 1-2.4 2.4-2.4z" fill="#918b7d" />
      <path d="M40 48h44" stroke="#8d8779" strokeWidth="0.6" />
      <path d="M88 48h44" stroke="#8d8779" strokeWidth="0.6" />
      <path d="M136 48h44" stroke="#8d8779" strokeWidth="0.6" />
    </Svg>
  );
}

export function SizeGuideBed() {
  return (
    <Svg viewBox="0 0 160 50" label="Queen bed with headboard">
      <ellipse cx="80" cy="48.2" rx="70" ry="1.8" fill="#c4b8a4" opacity="0.5" />
      <rect x="10" y="3" width="7" height="45" fill="#5e4d32" />
      <rect x="143" y="3" width="7" height="45" fill="#5e4d32" />
      <path d="M17 5h126v30H17z" fill="#7a7468" />
      <path d="M22 9h116v22H22z" fill="#8d8779" />
      <path d="M26 12h108v4H26z" fill="#9a9486" opacity="0.7" />
      <path d="M12 33h136v15H12z" fill="#d9d0bf" />
      <path d="M16 36h128v8H16z" fill="#ece6d8" />
      <path d="M30 26h42c3 0 6 2.4 6 5.4V39H24v-7.6c0-3 3-5.4 6-5.4z" fill="#f4eee4" />
      <path d="M88 26h42c3 0 6 2.4 6 5.4V39H82v-7.6c0-3 3-5.4 6-5.4z" fill="#efe6d6" />
      <path d="M30 26h42" stroke="#d8ccb8" strokeWidth="1.4" />
      <path d="M88 26h42" stroke="#d8ccb8" strokeWidth="1.4" />
    </Svg>
  );
}

export function SizeGuideWall() {
  return (
    <Svg viewBox="0 0 400 280" label="Representative interior wall">
      <rect width="400" height="248" fill="#f3eee4" />
      <rect y="18" width="400" height="1.5" fill="#e0d6c6" />
      <rect y="176" width="400" height="72" fill="#e8dfd0" />
      <rect y="174" width="400" height="2.5" fill="#d4c8b4" />
      <rect x="36" y="176" width="1.25" height="72" fill="#ddd2c0" />
      <rect x="133" y="176" width="1.25" height="72" fill="#ddd2c0" />
      <rect x="230" y="176" width="1.25" height="72" fill="#ddd2c0" />
      <rect x="327" y="176" width="1.25" height="72" fill="#ddd2c0" />
      <rect y="246" width="400" height="10" fill="#cfc3ae" />
      <rect y="256" width="400" height="24" fill="#d8cbb6" />
      <path d="M0 256h400" stroke="#c4b79f" strokeWidth="1" />
    </Svg>
  );
}

export function SizeGuideFurniture({ id }) {
  if (id === 'sofa') {
    return <SizeGuideSofa />;
  }
  if (id === 'bed') {
    return <SizeGuideBed />;
  }
  if (id === 'wall') {
    return <SizeGuideWall />;
  }
  return null;
}

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
