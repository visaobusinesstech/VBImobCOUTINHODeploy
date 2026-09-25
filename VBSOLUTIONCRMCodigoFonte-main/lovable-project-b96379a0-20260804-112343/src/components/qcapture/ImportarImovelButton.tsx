import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useImoveis } from "@/hooks/useImoveis";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Home, Loader2 } from "lucide-react";

interface ImportarImovelButtonProps {
  imovel: {
    titulo: string;
    tipo?: string;
    operacao?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    preco: number;
    area?: number;
    quartos?: number;
    banheiros?: number;
    vagas?: number;
    url_anuncio?: string;
    fotos?: string[];
  };
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline" | "default";
}

export function ImportarImovelButton({ imovel, size = "sm", variant = "ghost" }: ImportarImovelButtonProps) {
  const { createImovel } = useImoveis();
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleImportar = async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    try {
      const descricao = imovel.url_anuncio
        ? `Importado da captação. Anúncio original: ${imovel.url_anuncio}`
        : "Importado da captação de mercado.";

      const result = await createImovel({
        titulo: imovel.titulo,
        tipo: imovel.tipo || "Apartamento",
        operacao: imovel.operacao || "Venda",
        bairro: imovel.bairro || null,
        cidade: imovel.cidade || "Brasília",
        estado: imovel.estado || "DF",
        preco: imovel.preco,
        area: imovel.area || 0,
        quartos: imovel.quartos || 0,
        banheiros: imovel.banheiros || 0,
        vagas: imovel.vagas || 0,
        descricao,
        status: "Ativo",
        fotos: imovel.fotos && imovel.fotos.length > 0 ? imovel.fotos : [],
        ...(imovel.url_anuncio ? { url_anuncio: imovel.url_anuncio } : {}),
      } as any);

      if (result) {
        toast({ title: "Imóvel importado para sua carteira!" });
      }
    } catch {
      toast({ title: "Erro ao importar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size={size} variant={variant} onClick={handleImportar} disabled={loading} title="Salvar nos Meus Imóveis" className="w-full">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
      <span>{loading ? "Importando..." : "Salvar na Minha Carteira"}</span>
    </Button>
  );
}
