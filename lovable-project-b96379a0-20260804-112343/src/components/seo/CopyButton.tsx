import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  /** Rótulo curto exibido no botão (opcional) */
  buttonText?: string;
  size?: "sm" | "xs" | "icon";
  variant?: "ghost" | "outline" | "secondary";
  className?: string;
  disabled?: boolean;
}

export function CopyButton({
  value,
  label = "Conteúdo",
  buttonText,
  size = "xs",
  variant = "ghost",
  className,
  disabled,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = value ?? "";
    if (!text) {
      toast.error(`${label} vazio — nada para copiar`);
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const sizeClasses =
    size === "xs" ? "h-6 px-2 text-[11px] gap-1" :
    size === "icon" ? "h-7 w-7 p-0" :
    "h-8 px-2 text-xs gap-1";

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleCopy}
      disabled={disabled || !value}
      title={copied ? "Copiado!" : `Copiar ${label.toLowerCase()}`}
      aria-label={`Copiar ${label.toLowerCase()}`}
      className={cn(sizeClasses, className)}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {size !== "icon" && (buttonText ?? (copied ? "Copiado" : "Copiar"))}
    </Button>
  );
}
