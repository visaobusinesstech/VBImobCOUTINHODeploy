import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        {/* Animated building illustration */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto mb-8 w-48 h-48"
        >
          <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
          <div className="absolute inset-4 rounded-full bg-primary/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex gap-1.5 items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 60 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="w-6 bg-primary/30 rounded-t-sm"
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 90 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="w-8 bg-primary/50 rounded-t-sm"
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 70 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="w-6 bg-primary/40 rounded-t-sm"
              />
            </div>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute top-6"
            >
              <MapPin className="w-8 h-8 text-primary" />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-7xl font-black text-primary mb-2">404</h1>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Imóvel não encontrado
          </h2>
          <p className="text-muted-foreground mb-6">
            Parece que essa página mudou de endereço. Use os botões abaixo para continuar.
          </p>



          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <Button
              onClick={() => navigate("/")}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Home className="w-4 h-4" />
              Ir para Início
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
