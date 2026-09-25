import { useMemo } from "react";

interface ScoreGaugeProps {
  score: number; // 0-100
  size?: number;
}

function getScoreColor(score: number) {
  if (score >= 86) return "hsl(var(--chart-2))"; // green
  if (score >= 71) return "hsl(142 71% 45%)";
  if (score >= 41) return "hsl(45 93% 47%)"; // yellow
  return "hsl(0 84% 60%)"; // red
}

function getScoreLabel(score: number) {
  if (score >= 86) return "Captação Prioritária";
  if (score >= 71) return "Alta Probabilidade";
  if (score >= 41) return "Boa Oportunidade";
  return "Baixa Chance";
}

export function ScoreGauge({ score, size = 200 }: ScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = getScoreColor(clampedScore);
  const label = getScoreLabel(clampedScore);

  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size * 0.38;
  const strokeWidth = size * 0.08;

  // Arc from 180° to 0° (half circle)
  const startAngle = Math.PI;
  const endAngle = 0;
  const sweepAngle = startAngle - (startAngle - endAngle) * (clampedScore / 100);

  const bgArc = useMemo(() => {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy - r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy - r * Math.sin(endAngle);
    return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  }, [cx, cy, r]);

  const valueArc = useMemo(() => {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy - r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(sweepAngle);
    const y2 = cy - r * Math.sin(sweepAngle);
    const largeArc = clampedScore > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }, [cx, cy, r, sweepAngle, clampedScore]);

  // Needle
  const needleAngle = startAngle - (startAngle - endAngle) * (clampedScore / 100);
  const needleLen = r - strokeWidth;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6 + 20}`}>
        {/* Background arc */}
        <path d={bgArc} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* Value arc */}
        {clampedScore > 0 && (
          <path d={valueArc} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        )}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="hsl(var(--foreground))" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="hsl(var(--foreground))" />
        {/* Score text */}
        <text x={cx} y={cy - r * 0.25} textAnchor="middle" className="fill-foreground" fontSize={size * 0.18} fontWeight="bold">
          {clampedScore}
        </text>
      </svg>
      <span className="text-sm font-semibold mt-1" style={{ color }}>{label}</span>
      <span className="text-xs text-muted-foreground">Q-Capture Score</span>
    </div>
  );
}
