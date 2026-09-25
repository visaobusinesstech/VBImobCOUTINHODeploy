import { motion } from "framer-motion";
import { Check, Home, Info, Image, DollarSign, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { label: "Básico", icon: Home },
  { label: "Detalhes", icon: Info },
  { label: "Mídia", icon: Image },
  { label: "Financeiro", icon: DollarSign },
  { label: "Publicar", icon: Send },
];

interface StepperCadastroProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  completedSteps: Set<number>;
}

export function StepperCadastro({ currentStep, onStepClick, completedSteps }: StepperCadastroProps) {
  const progress = ((currentStep) / (steps.length - 1)) * 100;

  return (
    <div className="w-full">
      {/* Mobile: simplified */}
      <div className="sm:hidden flex items-center justify-between px-2 mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          Etapa {currentStep + 1} de {steps.length}
        </span>
        <span className="text-xs font-semibold text-primary">{steps[currentStep].label}</span>
      </div>
      <div className="sm:hidden w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Desktop: full stepper */}
      <div className="hidden sm:flex items-center justify-between relative mb-6">
        {/* Background line */}
        <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-border" />
        <div className="absolute top-5 left-[10%] h-0.5 bg-primary transition-all duration-500" style={{ width: `${progress * 0.8}%` }} />

        {steps.map((step, i) => {
          const isCompleted = completedSteps.has(i);
          const isCurrent = i === currentStep;
          const Icon = step.icon;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onStepClick(i)}
              className="flex flex-col items-center gap-1.5 z-10 group"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                  isCurrent
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                    : isCompleted
                    ? "bg-primary/10 text-primary border-primary"
                    : "bg-card text-muted-foreground border-border group-hover:border-primary/50"
                )}
              >
                {isCompleted && !isCurrent ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </motion.div>
              <span
                className={cn(
                  "text-[11px] font-medium transition-colors",
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
