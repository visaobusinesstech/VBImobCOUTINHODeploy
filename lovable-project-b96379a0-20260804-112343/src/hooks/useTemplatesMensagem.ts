import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface TemplateMensagem {
  id: string;
  imobiliaria_id: string;
  tipo: string;
  mensagem: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_TIPOS = [
  {
    value: "aniversario", label: "🎂 Aniversário",
    defaultMsg: "Feliz Aniversário, {nome}! Desejamos muitas felicidades e realizações!",
    opcoes: [
      "🎂 Feliz Aniversário, {nome}! Desejamos muitas felicidades e realizações!",
      "🎉 Parabéns, {nome}! Que este novo ciclo traga muita paz, saúde e conquistas!",
      "🥳 Hoje é seu dia, {nome}! Que a vida te reserve sempre o melhor. Felicidades!",
      "🎂 {nome}, feliz aniversário! Que seus sonhos se realizem neste novo ano de vida!",
      "✨ Muitas felicidades, {nome}! Que seu dia seja tão especial quanto você merece!",
    ],
  },
  {
    value: "casamento", label: "💍 Aniversário de Casamento",
    defaultMsg: "Feliz Aniversário de Casamento, {nome}! Que o amor continue florescendo!",
    opcoes: [
      "💍 Feliz Aniversário de Casamento, {nome}! Que o amor continue florescendo!",
      "💕 Parabéns pelo aniversário de casamento, {nome}! Que a cada ano o amor se renove!",
      "🥂 {nome}, feliz bodas! Que a união de vocês continue sendo fonte de alegria e companheirismo!",
      "💍 Hoje é dia de celebrar o amor, {nome}! Feliz aniversário de casamento!",
      "❤️ {nome}, que o amor que os uniu continue crescendo a cada dia. Parabéns!",
    ],
  },
  {
    value: "profissao", label: "🎉 Dia da Profissão",
    defaultMsg: "Feliz Dia do(a) {profissao}, {nome}! Parabéns pela dedicação à sua profissão!",
    opcoes: [
      "🎉 Feliz Dia do(a) {profissao}, {nome}! Parabéns pela dedicação à sua profissão!",
      "👏 Parabéns, {nome}! Hoje é o dia do(a) {profissao}. Obrigado por fazer a diferença!",
      "🏆 {nome}, feliz Dia do(a) {profissao}! Sua dedicação é inspiradora!",
      "⭐ Hoje celebramos os profissionais como você, {nome}! Feliz Dia do(a) {profissao}!",
      "🎯 {nome}, parabéns pelo Dia do(a) {profissao}! Continue brilhando na sua carreira!",
    ],
  },
  {
    value: "filho_aniversario", label: "🎈 Aniversário de Filho",
    defaultMsg: "Hoje é aniversário de {filho}! Parabéns, {nome}! Desejamos muitas alegrias em família!",
    opcoes: [
      "🎈 Hoje é aniversário de {filho}! Parabéns, {nome}! Desejamos muitas alegrias em família!",
      "🎂 Parabéns ao(à) {filho}! {nome}, que esse dia seja de muita festa e alegria!",
      "🥳 {nome}, hoje {filho} está de parabéns! Desejamos um dia incrível para toda a família!",
      "🎉 Feliz aniversário para {filho}! {nome}, aproveitem muito esse dia especial!",
      "🎁 {nome}, que o aniversário de {filho} seja repleto de amor e momentos inesquecíveis!",
    ],
  },
  {
    value: "mudanca", label: "🏠 Aniversário de Mudança",
    defaultMsg: "Parabéns, {nome}! Hoje faz mais um ano no seu lar. Que sua casa continue cheia de boas energias!",
    opcoes: [
      "🏠 Parabéns, {nome}! Hoje faz mais um ano no seu lar. Que sua casa continue cheia de boas energias!",
      "🎉 {nome}, feliz aniversário de mudança! Esperamos que esteja amando cada momento no seu imóvel!",
      "🏡 {nome}, já faz um ano! Que seu lar continue sendo sinônimo de conforto e felicidade!",
      "✨ {nome}, parabéns pelo aniversário da sua mudança! Que venham muitos anos de alegria nesse lar!",
      "🎊 {nome}, hoje comemoramos mais um ano no seu imóvel. Que bom poder fazer parte dessa história!",
    ],
  },
  {
    value: "compra_imovel", label: "🔑 Aniversário de Compra",
    defaultMsg: "Parabéns, {nome}! Hoje faz mais um ano da conquista do seu imóvel. Uma grande realização!",
    opcoes: [
      "🔑 Parabéns, {nome}! Hoje faz mais um ano da conquista do seu imóvel. Uma grande realização!",
      "🏆 {nome}, feliz aniversário da compra do seu imóvel! Que essa conquista continue trazendo alegrias!",
      "🎉 {nome}, hoje celebramos mais um ano de uma das maiores conquistas da vida. Parabéns!",
      "🏠 {nome}, que orgulho! Mais um ano do seu imóvel próprio. Desejamos muitas bênçãos!",
      "✨ {nome}, parabéns por mais um aniversário da aquisição do seu imóvel. Que venham muitos mais!",
    ],
  },
  {
    value: "reativacao", label: "🔄 Reativação",
    defaultMsg: "Oi, {nome}! Faz um tempo que a gente não conversa. Passei aqui só pra saber como você está e lembrar que, se precisar de algo relacionado ao seu imóvel ou a uma nova oportunidade, estou por perto. 🤝",
    opcoes: [
      "🔄 Oi, {nome}! Faz um tempo que a gente não conversa. Se surgir qualquer necessidade com o seu imóvel ou um novo projeto, é só me chamar!",
      "👋 {nome}, tudo bem? Passando pra reforçar que continuo à disposição — apareceram oportunidades novas por aqui que talvez te interessem.",
      "✨ {nome}, saudades! Se quiser reavaliar seu imóvel ou receber sugestões novas do mercado, é só responder essa mensagem.",
      "🏡 Oi, {nome}! Quanto tempo. Bora colocar em dia o que está acontecendo no mercado imobiliário da sua região? Posso te enviar um panorama rápido.",
      "🤝 {nome}, tudo certo? Só um oi carinhoso pra você — sempre que precisar de ajuda com locação, venda ou avaliação, conte comigo!",
    ],
  },
];

export function useTemplatesMensagem() {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateMensagem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("mensagem_templates")
      .select("*")
      .order("tipo");

    if (error) {
      toast({ title: "Erro ao carregar templates", description: error.message, variant: "destructive" });
    } else {
      setTemplates((data ?? []) as TemplateMensagem[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = async (tipo: string, mensagem: string) => {
    if (!user) return false;
    const existing = templates.find(t => t.tipo === tipo);
    if (existing) {
      const { error } = await supabase
        .from("mensagem_templates")
        .update({ mensagem } as any)
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Erro ao atualizar template", description: error.message, variant: "destructive" });
        return false;
      }
    } else {
      const { error } = await supabase
        .from("mensagem_templates")
        .insert({ imobiliaria_id: imobiliariaId, tipo, mensagem } as any);
      if (error) {
        toast({ title: "Erro ao criar template", description: error.message, variant: "destructive" });
        return false;
      }
    }
    toast({ title: "Template salvo!" });
    await fetch();
    return true;
  };

  const getTemplate = (tipo: string): string => {
    const t = templates.find(t => t.tipo === tipo);
    if (t) return t.mensagem;
    return TEMPLATE_TIPOS.find(tt => tt.value === tipo)?.defaultMsg || "";
  };

  return { templates, loading, upsert, getTemplate, refetch: fetch };
}
