import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, MapPin, Ruler, BedDouble, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TIPOS_IMOVEL, FINALIDADES, CONSERVACOES, PADROES, type WizardState } from "./types";

interface Props {
  data: WizardState["imovel"];
  onChange: (patch: Partial<WizardState["imovel"]>) => void;
}

const onlyDigits = (v: string) => v.replace(/\D/g, "");
const maskCEP = (v: string) => onlyDigits(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

export function Step1Imovel({ data, onChange }: Props) {
  const buscarCep = async () => {
    const cep = onlyDigits(data.cep);
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (!j.erro) {
        onChange({
          endereco: j.logradouro || data.endereco,
          bairro: j.bairro || data.bairro,
          cidade: j.localidade || data.cidade,
          estado: j.uf || data.estado,
        });
      }
    } catch { /* silencioso */ }
  };

  const Section = ({ icon: Icon, title, children }: any) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
      <Separator />
    </div>
  );

  const F = ({ label, children, full }: any) => (
    <div className={`space-y-1 ${full ? "sm:col-span-2 md:col-span-3" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <Section icon={Building2} title="Identificação">
        <F label="Tipo do imóvel *">
          <Select value={data.tipo} onValueChange={(v) => onChange({ tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_IMOVEL.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="Finalidade *">
          <Select value={data.finalidade} onValueChange={(v) => onChange({ finalidade: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FINALIDADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="Padrão construtivo">
          <Select value={data.padrao_construtivo} onValueChange={(v) => onChange({ padrao_construtivo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PADROES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </F>
      </Section>

      <Section icon={MapPin} title="Localização">
        <F label="CEP">
          <Input value={data.cep} onChange={(e) => onChange({ cep: maskCEP(e.target.value) })} onBlur={buscarCep} placeholder="00000-000" inputMode="numeric" />
        </F>
        <F label="Endereço" full>
          <Input value={data.endereco} onChange={(e) => onChange({ endereco: e.target.value })} />
        </F>
        <F label="Bairro *"><Input value={data.bairro} onChange={(e) => onChange({ bairro: e.target.value })} /></F>
        <F label="Cidade *"><Input value={data.cidade} onChange={(e) => onChange({ cidade: e.target.value })} /></F>
        <F label="UF"><Input value={data.estado} maxLength={2} onChange={(e) => onChange({ estado: e.target.value.toUpperCase() })} /></F>
        <F label="Latitude"><Input value={data.latitude} onChange={(e) => onChange({ latitude: e.target.value })} placeholder="-15.7942" /></F>
        <F label="Longitude"><Input value={data.longitude} onChange={(e) => onChange({ longitude: e.target.value })} placeholder="-47.8822" /></F>
      </Section>

      <Section icon={Ruler} title="Dimensões e idade">
        <F label="Área do terreno (m²)"><Input value={data.area_terreno} inputMode="decimal" onChange={(e) => onChange({ area_terreno: e.target.value })} /></F>
        <F label="Área construída (m²) *"><Input value={data.area_construida} inputMode="decimal" onChange={(e) => onChange({ area_construida: e.target.value })} /></F>
        <F label="Idade do imóvel (anos)"><Input value={data.idade} inputMode="numeric" onChange={(e) => onChange({ idade: e.target.value })} /></F>
        <F label="Estado de conservação">
          <Select value={data.estado_conservacao} onValueChange={(v) => onChange({ estado_conservacao: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONSERVACOES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </F>
      </Section>

      <Section icon={BedDouble} title="Ambientes">
        <F label="Quartos"><Input value={data.quartos} inputMode="numeric" onChange={(e) => onChange({ quartos: e.target.value })} /></F>
        <F label="Suítes"><Input value={data.suites} inputMode="numeric" onChange={(e) => onChange({ suites: e.target.value })} /></F>
        <F label="Banheiros"><Input value={data.banheiros} inputMode="numeric" onChange={(e) => onChange({ banheiros: e.target.value })} /></F>
        <F label="Garagens"><Input value={data.garagens} inputMode="numeric" onChange={(e) => onChange({ garagens: e.target.value })} /></F>
        <F label="Área de lazer (m²)"><Input value={data.area_lazer} inputMode="decimal" onChange={(e) => onChange({ area_lazer: e.target.value })} /></F>
      </Section>

      <Section icon={Sparkles} title="Características especiais">
        <F label="Descrição (vista, acabamento, diferenciais, etc.)" full>
          <Textarea
            value={data.caracteristicas}
            onChange={(e) => onChange({ caracteristicas: e.target.value })}
            placeholder="Ex.: vista para o parque, acabamento porcelanato, varanda gourmet, energia solar..."
            rows={3}
          />
        </F>
      </Section>
    </div>
  );
}
