"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DimField = "width" | "height" | "gusset" | "layflatWidth" | "cutHeight" | "sealWidth";
export type DimValues = Partial<Record<DimField, number>> & { trimming?: number; widthShrinkage?: number };

export type ContentTypeDef = {
  fields: DimField[];
  labels: Partial<Record<DimField, string>>;
  diagramType: "standup" | "threeside" | "centerseal" | "rollform" | "label" | "shrinksleeve";
};

// ─── Config ───────────────────────────────────────────────────────────────────

export const CONTENT_TYPE_CONFIG: Record<string, ContentTypeDef> = {
  "Pouch — 3 Side Seal":  { fields: ["width", "height"],           labels: { width: "Pouch Width (mm)", height: "Repeat Length (mm)" },                                       diagramType: "threeside"    },
  "Pouch — Center Seal":  { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "centerseal"   },
  "Standup Pouch":        { fields: ["width", "height", "gusset"], labels: { width: "Pouch Width (mm)", height: "Repeat Length (mm)", gusset: "Bottom Gusset (mm)" },         diagramType: "standup"      },
  "Zipper Pouch":         { fields: ["width", "height", "gusset"], labels: { width: "Pouch Width (mm)", height: "Repeat Length (mm)", gusset: "Bottom Gusset (mm)" },         diagramType: "standup"      },
  "Roll Form — Milk":     { fields: ["width", "height", "sealWidth"], labels: { width: "Film Width (mm)", height: "Repeat Length (mm)", sealWidth: "Seal Width (mm)" },      diagramType: "rollform"     },
  "Roll Form — Oil":      { fields: ["width", "height", "sealWidth"], labels: { width: "Film Width (mm)", height: "Repeat Length (mm)", sealWidth: "Seal Width (mm)" },      diagramType: "rollform"     },
  "Roll Form — Snacks":   { fields: ["width", "height", "sealWidth"], labels: { width: "Film Width (mm)", height: "Repeat Length (mm)", sealWidth: "Seal Width (mm)" },      diagramType: "rollform"     },
  "PET + PE":             { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "BOPP + CPP":           { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "PET + MET PET + PE":   { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "BOPP + BOPP":          { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "PET + AL Foil + PE":   { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "BOPP + MET BOPP":      { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "Shrink Labels":        { fields: ["layflatWidth", "cutHeight"], labels: { layflatWidth: "Layflat Width (mm)", cutHeight: "Cut Repeat Length (mm)" },                        diagramType: "shrinksleeve" },
  "Wrap Around Labels":   { fields: ["width", "height"],           labels: { width: "Label Width (mm)", height: "Repeat Length (mm)" },                                      diagramType: "label"        },
  "Cut & Stack Labels":   { fields: ["width", "height"],           labels: { width: "Label Width (mm)", height: "Repeat Length (mm)" },                                      diagramType: "label"        },
  "In-Mould Labels":      { fields: ["width", "height"],           labels: { width: "Label Width (mm)", height: "Repeat Length (mm)" },                                      diagramType: "label"        },
  "Fertilizer Bags":      { fields: ["width", "height", "gusset"], labels: { width: "Bag Width (mm)",   height: "Bag Repeat Length (mm)", gusset: "Gusset (mm)" },                  diagramType: "threeside"    },
  "Cement Liner":         { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "Chemical Packaging":   { fields: ["width", "height", "gusset"], labels: { width: "Bag Width (mm)",   height: "Bag Repeat Length (mm)", gusset: "Gusset (mm)" },                  diagramType: "threeside"    },
  "FIBC / Jumbo Bags":    { fields: ["width", "height"],           labels: { width: "Bag Width (mm)",   height: "Bag Repeat Length (mm)" },                                          diagramType: "threeside"    },
  "Woven Sack Liner":     { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
};

// ─── Calculation Engine ───────────────────────────────────────────────────────

export type DimCalcResult = {
  repeatLength:  number;
  filmJobWidth:  number;
  filmJobHeight: number;
  areaPerUnit:   number;
  upsAcross:     number;
  filmRollWidth: number;
};

export function calcDimensions(
  contentType: string,
  dims: DimValues,
  machineWidth = 1300,
  trimming = 0,
  gap = 5,
): DimCalcResult {
  const cfg = CONTENT_TYPE_CONFIG[contentType];
  const w      = dims.width ?? dims.layflatWidth ?? 0;
  const h      = dims.height ?? dims.cutHeight ?? 0;
  const gusset = dims.gusset ?? 0;

  let repeatLength = h;
  if (cfg?.diagramType === "standup") repeatLength = h + gusset / 2;

  const filmJobWidth  = w + trimming * 2;
  const filmJobHeight = repeatLength + gap;
  const laneWidth     = filmJobWidth > 0 ? filmJobWidth + trimming : 1;
  const upsAcross     = machineWidth > 0 && laneWidth > 0 ? Math.floor(machineWidth / laneWidth) : 0;
  const filmRollWidth = upsAcross * laneWidth;
  const areaPerUnit   = (w / 1000) * (repeatLength / 1000);

  return { repeatLength, filmJobWidth, filmJobHeight, areaPerUnit, upsAcross, filmRollWidth };
}

// ─── SVG Canvas constants ─────────────────────────────────────────────────────

const VW = 320;
const VH = 260;
const PAD = 36;

// Dimension annotation line
function DimLine({ x1, y1, x2, y2, label, color = "#6366f1" }: {
  x1: number; y1: number; x2: number; y2: number; label: string; color?: string;
}) {
  const isH = Math.abs(y2 - y1) < 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} strokeDasharray="4 2" />
      <circle cx={x1} cy={y1} r={2.5} fill={color} />
      <circle cx={x2} cy={y2} r={2.5} fill={color} />
      <text x={mx + (isH ? 0 : -10)} y={my + (isH ? -7 : 0)}
        textAnchor="middle" fontSize={9} fill={color} fontWeight="600">{label}</text>
    </g>
  );
}

// Scale helper
function scaleToCanvas(w: number, h: number) {
  const maxW = VW - PAD * 2;
  const maxH = VH - PAD * 2;
  const s = Math.min(
    w > 0 ? maxW / w : 2,
    h > 0 ? maxH / h : 2,
    w > 0 || h > 0 ? 140 / Math.max(w, h, 1) : 1,
  );
  return {
    dw: w > 0 ? w * s : 110,
    dh: h > 0 ? h * s : 140,
    scale: s,
  };
}

// ── Trimming + Width Shrinkage overlays ──
function DimOverlays({ ox, oy, dw, dh, scale, dims }: {
  ox: number; oy: number; dw: number; dh: number; scale: number; dims: DimValues;
}) {
  const trimPx   = (dims.trimming       ?? 0) * scale;
  // Shrinkage: minimum 10px so it's always visible
  const rawShrink = (dims.widthShrinkage ?? 0);
  const shrinkPx  = rawShrink > 0 ? Math.max(rawShrink * scale, 10) : 0;

  return (
    <>
      {/* Trimming / Bleed — orange dashed rect outside the main shape */}
      {trimPx > 0 && (
        <g>
          <rect
            x={ox - trimPx} y={oy - trimPx}
            width={dw + 2 * trimPx} height={dh + 2 * trimPx}
            fill="#fff7ed" fillOpacity={0.45}
            stroke="#f97316" strokeWidth={1.2} strokeDasharray="5 3"
          />
          <text x={ox + dw / 2} y={oy - trimPx - 3}
            textAnchor="middle" fontSize={7} fill="#f97316" fontWeight="600">
            BLEED +{dims.trimming}mm
          </text>
        </g>
      )}
      {/* Width Shrinkage — vivid magenta/pink band on right with diagonal hatching */}
      {shrinkPx > 0 && (
        <g>
          {/* Solid colored band */}
          <rect
            x={ox + dw} y={oy}
            width={shrinkPx} height={dh}
            fill="#f0abfc" fillOpacity={0.7}
            stroke="#c026d3" strokeWidth={1.5}
          />
          {/* Diagonal hatch lines inside band */}
          {Array.from({ length: Math.ceil((dh + shrinkPx) / 5) }).map((_, i) => {
            const offset = i * 5;
            const x1 = ox + dw + Math.max(0, offset - dh);
            const y1 = oy + Math.min(dh, offset);
            const x2 = ox + dw + Math.min(shrinkPx, offset);
            const y2 = oy + Math.max(0, offset - shrinkPx);
            return x1 < ox + dw + shrinkPx && x2 > ox + dw
              ? <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c026d3" strokeWidth={1} opacity={0.5} />
              : null;
          })}
          {/* Dimension arrow + label */}
          <line x1={ox + dw} y1={oy + dh + 10} x2={ox + dw + shrinkPx} y2={oy + dh + 10}
            stroke="#c026d3" strokeWidth={1.5} markerEnd="url(#arrow-shrink)" />
          <circle cx={ox + dw} cy={oy + dh + 10} r={2.5} fill="#c026d3" />
          <circle cx={ox + dw + shrinkPx} cy={oy + dh + 10} r={2.5} fill="#c026d3" />
          <text x={ox + dw + shrinkPx / 2} y={oy + dh + 22}
            textAnchor="middle" fontSize={8} fill="#86198f" fontWeight="800">
            SHRINK +{rawShrink}mm
          </text>
          {/* Vertical label inside band (rotated) */}
          <text
            x={ox + dw + shrinkPx / 2} y={oy + dh / 2}
            textAnchor="middle" fontSize={7} fill="#86198f" fontWeight="700"
            transform={`rotate(-90,${ox + dw + shrinkPx / 2},${oy + dh / 2})`}>
            +{rawShrink}mm
          </text>
        </g>
      )}
      {/* Arrow marker def */}
      <defs>
        <marker id="arrow-shrink" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#c026d3" />
        </marker>
      </defs>
    </>
  );
}

// ── Standup Pouch ──
function StandupDiagram({ dims }: { dims: DimValues }) {
  const w = dims.width ?? 0;
  const h = dims.height ?? 0;
  const gus = dims.gusset ?? 0;
  const { dw, dh, scale } = scaleToCanvas(w, h + gus * 0.4);
  const ox = (VW - dw) / 2;
  const oy = PAD + 8;
  const sealH = 10; const sealSW = 10;
  const gd = gus > 0 ? (gus / (h + gus)) * dh * 0.4 : 0;
  const nw = Math.max(dw * 0.1, 8);

  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={ox} oy={oy} dw={dw} dh={dh} scale={scale} dims={dims} />
      <path d={`M${ox},${oy+sealH} L${ox},${oy+dh-gd} Q${ox},${oy+dh} ${ox+gd},${oy+dh} L${ox+dw-gd},${oy+dh} Q${ox+dw},${oy+dh} ${ox+dw},${oy+dh-gd} L${ox+dw},${oy+sealH} L${ox+dw-nw},${oy} L${ox},${oy} Z`}
        fill="#eef2ff" stroke="#6366f1" strokeWidth={1.5} />
      <rect x={ox} y={oy} width={dw-nw} height={sealH} fill="#c7d2fe" stroke="#6366f1" strokeWidth={1} opacity={0.8} />
      <text x={ox+(dw-nw)/2} y={oy+sealH-2} textAnchor="middle" fontSize={7} fill="#4338ca">TOP SEAL</text>
      <rect x={ox} y={oy+sealH} width={sealSW} height={dh-sealH-gd} fill="#c7d2fe" stroke="#6366f1" strokeWidth={1} opacity={0.6} />
      <rect x={ox+dw-sealSW} y={oy+sealH} width={sealSW} height={dh-sealH-gd} fill="#c7d2fe" stroke="#6366f1" strokeWidth={1} opacity={0.6} />
      {gd > 0 && <>
        <rect x={ox} y={oy+dh-gd} width={dw} height={gd} fill="#a5f3fc" stroke="#0891b2" strokeWidth={1} opacity={0.6} />
        <text x={ox+dw/2} y={oy+dh-gd/2+3} textAnchor="middle" fontSize={7} fill="#0e7490">GUSSET</text>
      </>}
      {w > 0 && <DimLine x1={ox} y1={oy+dh+16} x2={ox+dw} y2={oy+dh+16} label={`${w}mm`} />}
      {h > 0 && <DimLine x1={ox-20} y1={oy} x2={ox-20} y2={oy+dh} label={`${h}mm`} />}
      {gus > 0 && <DimLine x1={ox+dw+14} y1={oy+dh-gd} x2={ox+dw+14} y2={oy+dh} label={`${gus}mm`} color="#0891b2" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">Standup Pouch</text>
    </svg>
  );
}

// ── 3-Side Seal ──
function ThreeSideDiagram({ dims }: { dims: DimValues }) {
  const w = dims.width ?? 0; const h = dims.height ?? 0;
  const { dw, dh, scale } = scaleToCanvas(w, h);
  const ox = (VW - dw) / 2; const oy = (VH - dh) / 2 - 10;
  const sw = 10;
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={ox} oy={oy} dw={dw} dh={dh} scale={scale} dims={dims} />
      <rect x={ox} y={oy} width={dw} height={dh} fill="#f0fdf4" stroke="#16a34a" strokeWidth={1.5} rx={2} />
      <rect x={ox} y={oy} width={sw} height={dh} fill="#bbf7d0" stroke="#16a34a" strokeWidth={1} opacity={0.7} />
      <rect x={ox+dw-sw} y={oy} width={sw} height={dh} fill="#bbf7d0" stroke="#16a34a" strokeWidth={1} opacity={0.7} />
      <rect x={ox} y={oy+dh-sw} width={dw} height={sw} fill="#bbf7d0" stroke="#16a34a" strokeWidth={1} opacity={0.7} />
      <line x1={ox} y1={oy+sw} x2={ox+dw} y2={oy+sw} stroke="#16a34a" strokeWidth={0.8} strokeDasharray="4 2" />
      <text x={ox+dw/2} y={oy+sw-2} textAnchor="middle" fontSize={7} fill="#15803d">FOLD</text>
      <text x={ox+dw/2} y={oy+dh-3} textAnchor="middle" fontSize={7} fill="#15803d">BTM SEAL</text>
      {w > 0 && <DimLine x1={ox} y1={oy+dh+16} x2={ox+dw} y2={oy+dh+16} label={`${w}mm`} color="#16a34a" />}
      {h > 0 && <DimLine x1={ox-20} y1={oy} x2={ox-20} y2={oy+dh} label={`${h}mm`} color="#16a34a" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">3-Side Seal Pouch</text>
    </svg>
  );
}

// ── Center Seal ──
function CenterSealDiagram({ dims }: { dims: DimValues }) {
  const w = dims.width ?? 0; const h = dims.height ?? 0;
  const { dw, dh, scale } = scaleToCanvas(w, h);
  const ox = (VW - dw) / 2; const oy = (VH - dh) / 2 - 10;
  const sh = 10; const cw = 8;
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={ox} oy={oy} dw={dw} dh={dh} scale={scale} dims={dims} />
      <rect x={ox} y={oy} width={dw} height={dh} fill="#fdf4ff" stroke="#a855f7" strokeWidth={1.5} rx={2} />
      <rect x={ox} y={oy} width={dw} height={sh} fill="#e9d5ff" stroke="#a855f7" strokeWidth={1} opacity={0.7} />
      <rect x={ox} y={oy+dh-sh} width={dw} height={sh} fill="#e9d5ff" stroke="#a855f7" strokeWidth={1} opacity={0.7} />
      <text x={ox+dw/2} y={oy+sh-2} textAnchor="middle" fontSize={7} fill="#7e22ce">TOP SEAL</text>
      <text x={ox+dw/2} y={oy+dh-3} textAnchor="middle" fontSize={7} fill="#7e22ce">BTM SEAL</text>
      <rect x={ox+dw/2-cw/2} y={oy+sh} width={cw} height={dh-sh*2} fill="#c4b5fd" stroke="#a855f7" strokeWidth={1} opacity={0.8} />
      {w > 0 && <DimLine x1={ox} y1={oy+dh+16} x2={ox+dw} y2={oy+dh+16} label={`${w}mm`} color="#a855f7" />}
      {h > 0 && <DimLine x1={ox-20} y1={oy} x2={ox-20} y2={oy+dh} label={`${h}mm`} color="#a855f7" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">Center Seal Pouch</text>
    </svg>
  );
}

// ── Roll Form ──
function RollFormDiagram({ dims }: { dims: DimValues }) {
  const w = dims.width ?? 0; const h = dims.height ?? 0;
  const sw = dims.sealWidth ?? 0;
  const { dw, dh, scale } = scaleToCanvas(w, h);
  const ox = (VW - dw) / 2; const oy = PAD + 20;
  const repeats = 3;
  const sealD = sw > 0 ? Math.max(sw * (dw / Math.max(w, 1)), 8) : 10;
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={ox} oy={oy} dw={dw} dh={dh} scale={scale} dims={dims} />
      {Array.from({ length: repeats }).map((_, ri) => {
        const ry = oy + ri * (dh + 3);
        return (
          <g key={ri}>
            <rect x={ox} y={ry} width={dw} height={dh} fill={ri % 2 === 0 ? "#fff7ed" : "#fef3c7"} stroke="#d97706" strokeWidth={1.5} rx={1} />
            <rect x={ox} y={ry} width={sealD} height={dh} fill="#fcd34d" stroke="#d97706" strokeWidth={1} opacity={0.6} />
            <rect x={ox+dw-sealD} y={ry} width={sealD} height={dh} fill="#fcd34d" stroke="#d97706" strokeWidth={1} opacity={0.6} />
            {ri < repeats-1 && <line x1={ox} y1={ry+dh+1.5} x2={ox+dw} y2={ry+dh+1.5} stroke="#d97706" strokeWidth={1} strokeDasharray="3 2" />}
          </g>
        );
      })}
      <ellipse cx={ox-18} cy={oy+dh*repeats/2} rx={12} ry={Math.min(dh*repeats*0.4, 40)} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1.5} />
      {w > 0 && <DimLine x1={ox} y1={oy+dh*repeats+16} x2={ox+dw} y2={oy+dh*repeats+16} label={`${w}mm`} color="#d97706" />}
      {h > 0 && <DimLine x1={ox-32} y1={oy} x2={ox-32} y2={oy+dh} label={`${h}mm`} color="#d97706" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">Roll Form</text>
    </svg>
  );
}

// ── Label ──
function LabelDiagram({ dims }: { dims: DimValues }) {
  const w = dims.width ?? 0; const h = dims.height ?? 0;
  const { dw, dh, scale } = scaleToCanvas(w, h);
  const cols = Math.min(3, Math.max(1, Math.floor((VW - PAD * 2) / (dw + 6))));
  const rows = Math.min(2, Math.max(1, Math.floor((VH - PAD * 2 - 20) / (dh + 6))));
  const gw = cols * dw + (cols-1) * 6;
  const gh = rows * dh + (rows-1) * 6;
  const gox = (VW - gw) / 2; const goy = (VH - gh) / 2 - 10;
  const br = Math.min(dw, dh) * 0.08;
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={gox} oy={goy} dw={dw} dh={dh} scale={scale} dims={dims} />
      <rect x={gox-8} y={goy-8} width={gw+16} height={gh+16} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 2" rx={4} />
      {Array.from({ length: rows }).map((_, ri) =>
        Array.from({ length: cols }).map((_, ci) => {
          const lx = gox + ci*(dw+6); const ly = goy + ri*(dh+6);
          const isFirst = ri===0 && ci===0;
          return (
            <g key={`${ri}-${ci}`}>
              <rect x={lx} y={ly} width={dw} height={dh}
                fill={isFirst ? "#eff6ff" : "#f8fafc"}
                stroke={isFirst ? "#3b82f6" : "#cbd5e1"}
                strokeWidth={isFirst ? 1.8 : 1} rx={br} />
              {isFirst && <text x={lx+dw/2} y={ly+dh/2+3} textAnchor="middle" fontSize={8} fill="#3b82f6" fontWeight="600">LABEL</text>}
            </g>
          );
        })
      )}
      {w > 0 && <DimLine x1={gox} y1={goy+gh+16} x2={gox+dw} y2={goy+gh+16} label={`${w}mm`} color="#3b82f6" />}
      {h > 0 && <DimLine x1={gox-20} y1={goy} x2={gox-20} y2={goy+dh} label={`${h}mm`} color="#3b82f6" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">Label</text>
    </svg>
  );
}

// ── Shrink Sleeve ──
function ShrinkSleeveDiagram({ dims }: { dims: DimValues }) {
  const lf = dims.layflatWidth ?? 0; const ch = dims.cutHeight ?? 0;
  const { dw, dh, scale } = scaleToCanvas(lf, ch);
  const ox = (VW - dw) / 2; const oy = (VH - dh) / 2 - 10;
  const ry = Math.max(dw * 0.12, 8); const sh = 10;
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={ox} oy={oy+ry} dw={dw} dh={dh-ry} scale={scale} dims={dims} />
      <rect x={ox} y={oy+ry} width={dw} height={dh-ry} fill="#fdf2f8" stroke="#ec4899" strokeWidth={1.5} />
      <ellipse cx={ox+dw/2} cy={oy+ry} rx={dw/2} ry={ry} fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
      <ellipse cx={ox+dw/2} cy={oy+dh} rx={dw/2} ry={ry} fill="#fce7f3" stroke="#ec4899" strokeWidth={1} />
      <rect x={ox} y={oy+ry} width={dw} height={sh} fill="#fbcfe8" opacity={0.7} />
      <text x={ox+dw/2} y={oy+ry+sh-2} textAnchor="middle" fontSize={7} fill="#be185d">SEAL</text>
      <line x1={ox} y1={oy+dh*0.3} x2={ox+dw} y2={oy+dh*0.3} stroke="#ec4899" strokeWidth={0.8} strokeDasharray="2 3" />
      <text x={ox+dw/2} y={oy+dh*0.3-3} textAnchor="middle" fontSize={6} fill="#db2777">PERFORATION</text>
      {lf > 0 && <DimLine x1={ox} y1={oy+dh+ry+14} x2={ox+dw} y2={oy+dh+ry+14} label={`LF:${lf}mm`} color="#ec4899" />}
      {ch > 0 && <DimLine x1={ox-22} y1={oy+ry} x2={ox-22} y2={oy+dh} label={`${ch}mm`} color="#ec4899" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">Shrink Sleeve</text>
    </svg>
  );
}

// ─── Main Diagram Component ───────────────────────────────────────────────────

export type DimensionDiagramProps = {
  contentType: string;
  dims: DimValues;
};

export function DimensionDiagram({ contentType, dims }: DimensionDiagramProps) {
  const cfg = CONTENT_TYPE_CONFIG[contentType];
  if (!cfg) return null;

  const DiagramMap = {
    standup:      StandupDiagram,
    threeside:    ThreeSideDiagram,
    centerseal:   CenterSealDiagram,
    rollform:     RollFormDiagram,
    label:        LabelDiagram,
    shrinksleeve: ShrinkSleeveDiagram,
  } as const;

  const Diagram = DiagramMap[cfg.diagramType];

  const hasTrim   = (dims.trimming ?? 0) > 0;
  const hasShrink = (dims.widthShrinkage ?? 0) > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-gradient-to-br from-slate-50 to-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center min-h-[220px]">
        <Diagram dims={dims} />
      </div>
      {/* Legend */}
      {(hasTrim || hasShrink) && (
        <div className="flex flex-wrap gap-2 px-2">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-3 rounded border-2 border-dashed border-orange-500 bg-orange-100 flex-shrink-0" />
            <span className="text-[9px] text-orange-700 font-semibold uppercase tracking-wide">
              Trimming Both Side{hasTrim ? ` (+${dims.trimming}mm)` : ""}
            </span>
          </div>
          {hasShrink && (
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-3 rounded border border-fuchsia-500 bg-fuchsia-200 flex-shrink-0"
                style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 2px, #c026d3 2px, #c026d3 3px)" }} />
              <span className="text-[9px] text-fuchsia-700 font-semibold uppercase tracking-wide">
                Width Shrinkage (+{dims.widthShrinkage}mm)
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-3 rounded border border-indigo-400 bg-indigo-100 flex-shrink-0" />
            <span className="text-[9px] text-indigo-600 font-semibold uppercase tracking-wide">
              Product Area
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dimension Input Panel ────────────────────────────────────────────────────

export function DimensionInputPanel({
  contentType,
  dims,
  onChange,
}: {
  contentType: string;
  dims: DimValues;
  onChange: (patch: DimValues) => void;
}) {
  const cfg = CONTENT_TYPE_CONFIG[contentType];
  if (!cfg) return null;

  const meta: Record<DimField, { placeholder: string; min: number }> = {
    width:        { placeholder: "e.g. 150", min: 1 },
    height:       { placeholder: "e.g. 220", min: 1 },
    gusset:       { placeholder: "e.g. 60",  min: 0 },
    layflatWidth: { placeholder: "e.g. 130", min: 1 },
    cutHeight:    { placeholder: "e.g. 200", min: 1 },
    sealWidth:    { placeholder: "e.g. 12",  min: 1 },
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {cfg.fields.map(field => (
        <div key={field}>
          <label className="text-[10px] font-semibold text-indigo-600 uppercase block mb-1">
            {cfg.labels[field] ?? field}
          </label>
          <input
            type="number"
            min={meta[field].min}
            step={1}
            placeholder={meta[field].placeholder}
            value={dims[field] || ""}
            onChange={e => onChange({ [field]: Number(e.target.value) || 0 })}
            className="w-full text-sm border border-indigo-200 rounded-xl px-3 py-2 bg-indigo-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
          />
        </div>
      ))}
    </div>
  );
}
