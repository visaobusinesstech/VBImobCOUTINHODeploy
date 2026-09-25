import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ReactNode, createContext, useContext, useState, useEffect, useRef } from "react";
import { LucideIcon, Info, TrendingUp, TrendingDown, Minus, Eye, EyeOff, Shield } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

// Context for value masking
const MaskContext = createContext<{ masked: boolean; toggle: () => void; setMasked: (val: boolean) => void }>({ 
  masked: false, 
  toggle: () => {},
  setMasked: () => {}
});

export function MaskProvider({ children }: { children: ReactNode }) {
  const [masked, setMasked] = useState(false);
  return (
    <MaskContext.Provider value={{ masked, toggle: () => setMasked(p => !p), setMasked }}>
      {children}
    </MaskContext.Provider>
  );
}

export function useMask() { return useContext(MaskContext); }

export function MaskToggle() {
  const { masked, toggle } = useMask();
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={toggle} 
      className={`gap-2 ${masked ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
      title={masked ? "Desativar Modo Segurança" : "Ativar Modo Segurança"}
    >
      <Shield className={`w-4 h-4 ${masked ? "fill-current" : ""}`} />
      <span className="text-xs font-bold">{masked ? "MODO SEGURANÇA ATIVO" : "MODO SEGURANÇA"}</span>
    </Button>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  delay?: number;
  tooltip?: string;
  trend?: number;
  sparkData?: number[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

function AnimatedValue({ value, masked }: { value: string; masked: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (masked || !ref.current) return;
    // Try to extract a number from the value for animation
    const numMatch = value.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
    const num = parseFloat(numMatch);
    const prevNumMatch = prevValue.current.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
    const prevNum = parseFloat(prevNumMatch);
    prevValue.current = value;

    if (!isNaN(num) && !isNaN(prevNum) && num !== prevNum) {
      const controls = animate(prevNum, num, {
        duration: 0.8,
        ease: "easeOut",
        onUpdate: (latest) => {
          if (!ref.current) return;
          // Reconstruct the formatted value
          const formatted = value.replace(numMatch.replace(".", ","), latest.toLocaleString("pt-BR", {
            minimumFractionDigits: value.includes(",") ? (value.split(",")[1]?.replace(/[^\d]/g, "").length || 0) : 0,
            maximumFractionDigits: value.includes(",") ? (value.split(",")[1]?.replace(/[^\d]/g, "").length || 0) : 0,
          }));
          ref.current.textContent = formatted;
        },
      });
      return controls.stop;
    }
  }, [value, masked]);

  if (masked) return <span>••••••</span>;
  return <span ref={ref}>{value}</span>;
}

export function MetricCard({
  title, value, change, changeType = "neutral", icon: Icon, delay = 0, tooltip, trend, sparkData,
}: MetricCardProps) {
  const { masked } = useMask();
  const trendColor = trend !== undefined
    ? trend > 0 ? "text-emerald-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
    : undefined;
  const TrendIcon = trend !== undefined
    ? trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
    : null;
  const sparkColor = changeType === "positive" ? "hsl(142, 71%, 45%)" : changeType === "negative" ? "hsl(0, 72%, 51%)" : "hsl(199, 89%, 48%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-4 md:p-5 glow-border group hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            {tooltip && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground/60 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground truncate">
            <AnimatedValue value={value} masked={masked} />
          </p>
          <div className="flex items-center gap-2">
            {change && !masked && (
              <p className={`text-[11px] font-medium ${
                changeType === "positive" ? "text-emerald-500" :
                changeType === "negative" ? "text-destructive" :
                "text-muted-foreground"
              }`}>
                {change}
              </p>
            )}
            {trend !== undefined && TrendIcon && (
              <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                trend > 0 ? "bg-emerald-500/10 text-emerald-500" :
                trend < 0 ? "bg-red-500/10 text-red-500" :
                "bg-muted text-muted-foreground"
              }`}>
                <TrendIcon className="w-3 h-3" />
                {trend > 0 ? "+" : ""}{trend.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          {sparkData && sparkData.length >= 2 && (
            <div className="opacity-60 group-hover:opacity-100 transition-opacity">
              <MiniSparkline data={sparkData} color={sparkColor} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
