import { useMask } from "@/components/shared/MetricCard";
import { Shield, Eye, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function SecurityModeBanner() {
  const { masked, setMasked } = useMask();
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState(0);

  if (!masked) return null;

  const handleExit = () => {
    setShowConfirm(true);
    setStep(1);
  };

  const confirmExit = () => {
    setStep(2);
    setTimeout(() => {
      setMasked(false);
      setShowConfirm(false);
      setStep(0);
      toast.success("Modo Segurança desativado", {
        description: "Os valores e dados sensíveis voltaram a ficar visíveis.",
      });
    }, 1500);
  };

  return (
    <>
      <div className="bg-primary/95 text-primary-foreground py-2 px-4 flex items-center justify-between shadow-lg sticky top-0 z-[60] animate-in fade-in slide-in-from-top duration-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Modo Segurança Ativo</p>
            <p className="text-[10px] opacity-90 hidden sm:block">Valores ocultos para apresentação segura ao cliente</p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleExit}
          className="h-8 gap-2 bg-white text-primary hover:bg-white/90"
        >
          <Eye className="w-3.5 h-3.5" />
          Sair do Modo Segurança
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <AlertDialogHeader>
                  <div className="flex items-center gap-3 mb-2 text-warning">
                    <AlertTriangle className="w-6 h-6" />
                    <AlertDialogTitle>Desativar Modo Segurança?</AlertDialogTitle>
                  </div>
                  <AlertDialogDescription className="text-sm">
                    Ao sair, todos os valores, comissões e dados sensíveis ficarão visíveis nesta tela.
                    Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6">
                  <AlertDialogCancel onClick={() => setShowConfirm(false)}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmExit} className="bg-primary hover:bg-primary/90">
                    Confirmar e Sair
                  </AlertDialogAction>
                </AlertDialogFooter>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-success animate-bounce" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-foreground">Finalizando Visualização...</h3>
                  <p className="text-sm text-muted-foreground">Restaurando visibilidade dos dados</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}