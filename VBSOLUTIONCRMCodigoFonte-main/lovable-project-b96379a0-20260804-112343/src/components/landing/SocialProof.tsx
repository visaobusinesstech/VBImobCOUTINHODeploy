import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const depoimentos = [
  {
    nome: "Ana Coutinho",
    empresa: "AC Imóveis · Brasília/DF",
    iniciais: "AC",
    texto:
      "Em 30 dias captamos 12 imóveis novos direto de proprietários. A IA de captação virou nosso principal canal — cortamos custo com portais pela metade.",
    resultado: "+12 captações em 30 dias",
  },
  {
    nome: "Rafael Menezes",
    empresa: "Menezes Consultoria Imobiliária",
    iniciais: "RM",
    texto:
      "O CRM com follow-up automático deixou de deixar lead esfriar. Fechamos 3 vendas no primeiro mês só recuperando contatos que estavam parados.",
    resultado: "3 vendas recuperadas",
  },
  {
    nome: "Juliana Prado",
    empresa: "JP Negócios Imobiliários",
    iniciais: "JP",
    texto:
      "A avaliação com IA impressiona os clientes. Fechei 2 exclusividades de captação apresentando o relatório em PDF na primeira visita.",
    resultado: "2 exclusividades fechadas",
  },
];

const logos = [
  "AC Imóveis",
  "Menezes",
  "JP Negócios",
  "Prime Corretora",
  "Bsb Realty",
  "Cerrado Imob",
];

export function SocialProof() {
  return (
    <section
      id="prova-social"
      aria-labelledby="prova-social-title"
      className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-background border-y border-border/50"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              ))}
            </div>
            <span>4.9/5 · corretores e imobiliárias que confiam na radarimobtech</span>
          </div>
          <h2 id="prova-social-title" className="text-3xl sm:text-4xl font-black tracking-tight">
            Já em uso por imobiliárias do DF e de todo o Brasil
          </h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
            Resultados reais de quem trocou planilha, portais caros e follow-up manual
            pela radarimobtech.
          </p>
        </div>

        {/* Logos row */}
        <div className="mb-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-center">
          {logos.map((nome) => (
            <div
              key={nome}
              className="h-14 flex items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-sm font-semibold text-muted-foreground/80"
            >
              {nome}
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid gap-6 md:grid-cols-3">
          {depoimentos.map((d, i) => (
            <motion.div
              key={d.nome}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Card className="h-full border-border/60 hover:border-primary/40 transition-colors">
                <CardContent className="p-6 flex flex-col h-full">
                  <Quote className="w-6 h-6 text-primary/60 mb-3" />
                  <p className="text-sm leading-relaxed text-foreground/90 flex-1">
                    "{d.texto}"
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 rounded-full px-3 py-1 self-start">
                    {d.resultado}
                  </div>
                  <div className="mt-5 pt-4 border-t border-border/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {d.iniciais}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{d.nome}</div>
                      <div className="text-xs text-muted-foreground">{d.empresa}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
