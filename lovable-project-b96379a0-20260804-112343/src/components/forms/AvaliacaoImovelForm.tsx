import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AvaliacaoFormProps {
  variant?: "hero" | "full";
}

const WHATSAPP_NUMBER = "5561984593746";

export const AvaliacaoImovelForm: React.FC<AvaliacaoFormProps> = ({ variant = "hero" }) => {
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    cidade: "",
    tipo_imovel: "",
    tipo_venda: "",
    valor_estimado: "",
    descricao: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = () => {
    if (!form.nome.trim() || form.nome.length > 100) return false;
    if (!form.whatsapp.trim() || form.whatsapp.length < 8 || form.whatsapp.length > 20) return false;
    if (!form.cidade.trim() || form.cidade.length > 100) return false;
    if (!form.tipo_imovel) return false;
    if (variant === "full" && !form.tipo_venda) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid()) return;
    setStatus("loading");

    const cleanNome = form.nome.trim().slice(0, 100);
    const cleanTelefone = form.whatsapp.trim().slice(0, 20);
    const mensagem = `[Avaliação] Tipo: ${form.tipo_imovel} | Cidade: ${form.cidade}${form.tipo_venda ? ` | Operação: ${form.tipo_venda}` : ""}${form.valor_estimado ? ` | Valor est.: ${form.valor_estimado}` : ""}${form.descricao ? ` | ${form.descricao.slice(0, 500)}` : ""}`;
    const msg = encodeURIComponent(
      `Olá! Meu nome é ${form.nome.trim()}, gostaria de uma avaliação gratuita do meu imóvel (${form.tipo_imovel}) em ${form.cidade}.`
    );
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
    const whatsappWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    const whatsappOpened = Boolean(whatsappWindow);

    if (whatsappWindow) {
      whatsappWindow.opener = null;
      whatsappWindow.focus();
    }

    try {
      const { error } = await supabase.functions.invoke("contato-landing", {
        body: {
          nome: cleanNome,
          email: `avaliacao+${Date.now()}@lead.com`,
          telefone: cleanTelefone,
          mensagem,
        },
      });

      if (error) throw error;
      setStatus("success");
    } catch (err) {
      console.error("[CaptacaoAvaliacao:error]", err);
      setStatus("error");
    } finally {
      if (!whatsappOpened) {
        window.location.href = whatsappUrl;
      }
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center animate-in fade-in duration-500">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className="text-lg font-semibold text-foreground">Recebemos seus dados!</p>
        <p className="text-muted-foreground text-sm">Confira seu WhatsApp para continuar.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center animate-in fade-in duration-500">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-lg font-semibold text-foreground">Algo deu errado, tente novamente.</p>
        <Button onClick={() => setStatus("idle")} variant="outline" className="mt-2">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`nome-${variant}`}>Nome</Label>
          <Input
            id={`nome-${variant}`}
            placeholder="Seu nome completo"
            value={form.nome}
            onChange={(e) => handleChange("nome", e.target.value)}
            maxLength={100}
            required
            className="bg-background text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`whatsapp-${variant}`}>WhatsApp</Label>
          <Input
            id={`whatsapp-${variant}`}
            placeholder="(00) 00000-0000"
            value={form.whatsapp}
            onChange={(e) => handleChange("whatsapp", e.target.value)}
            maxLength={20}
            required
            className="bg-background text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`cidade-${variant}`}>Cidade</Label>
          <Input
            id={`cidade-${variant}`}
            placeholder="Ex: Brasília"
            value={form.cidade}
            onChange={(e) => handleChange("cidade", e.target.value)}
            maxLength={100}
            required
            className="bg-background text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo do imóvel</Label>
          <Select value={form.tipo_imovel} onValueChange={(v) => handleChange("tipo_imovel", v)}>
            <SelectTrigger className="bg-background text-foreground">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Casa">Casa</SelectItem>
              <SelectItem value="Apartamento">Apartamento</SelectItem>
              <SelectItem value="Comercial">Comercial</SelectItem>
              <SelectItem value="Terreno">Terreno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {variant === "full" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de operação</Label>
              <Select value={form.tipo_venda} onValueChange={(v) => handleChange("tipo_venda", v)}>
                <SelectTrigger className="bg-background text-foreground">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor_estimado">Valor estimado (opcional)</Label>
              <Input
                id="valor_estimado"
                placeholder="R$ 000.000"
                value={form.valor_estimado}
                onChange={(e) => handleChange("valor_estimado", e.target.value)}
                className="bg-background text-foreground"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="descricao" className="flex flex-col gap-0.5">
                <span>Descrição do imóvel <span className="text-muted-foreground font-normal">(opcional)</span></span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Quanto mais detalhes, mais precisa será a avaliação
                </span>
              </Label>
              <span
                className={`text-[11px] tabular-nums ${
                  form.descricao.length > 450 ? "text-destructive" : "text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {form.descricao.length}/500
              </span>
            </div>
            <Textarea
              id="descricao"
              placeholder={`Ex.: Apartamento de 3 quartos (1 suíte), 2 vagas, andar alto com vista livre.\nReformado em 2023, piso porcelanato, cozinha planejada.\nCondomínio com lazer completo, próximo a metrô e escolas.`}
              value={form.descricao}
              onChange={(e) => handleChange("descricao", e.target.value.slice(0, 500))}
              maxLength={500}
              rows={5}
              className="bg-background text-foreground resize-y min-h-[120px] leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">
              Inclua: metragem, quartos/suítes, vagas, andar, estado de conservação, reformas, diferenciais e localização.
            </p>
          </div>

        </>
      )}

      <Button
        type="submit"
        disabled={!isValid() || status === "loading"}
        className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white transition-all duration-200"
        aria-label="Enviar formulário de avaliação"
      >
        {status === "loading" ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : null}
        {status === "loading" ? "Enviando..." : "Quero minha avaliação gratuita"}
      </Button>
    </form>
  );
};
