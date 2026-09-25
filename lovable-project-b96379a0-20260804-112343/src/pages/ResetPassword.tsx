import { useState, useEffect } from "react";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha atualizada com sucesso!" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Link inválido ou expirado.</p>
          <Button variant="outline" onClick={() => navigate("/auth")}>Voltar ao login</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Seo title="Redefinir senha — radarimobtech" description="Defina uma nova senha para acessar sua conta radarimobtech." path="/reset-password" noindex />
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Nova Senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Digite sua nova senha</p>
        </div>
        <div className="glass-card p-6 glow-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs">Nova Senha</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-secondary border-border"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : "Redefinir senha"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default ResetPassword;
