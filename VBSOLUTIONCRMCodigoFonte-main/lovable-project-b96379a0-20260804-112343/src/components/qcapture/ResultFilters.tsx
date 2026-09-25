import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

export type FilterState = {
  tipo: string;
  quartosMin: string;
  vagasMin: string;
  suitesMin: string;
  areaMin: string;
  areaMax: string;
  precoMin: string;
  precoMax: string;
  portal: string;
};

const EMPTY_FILTERS: FilterState = {
  tipo: "todos",
  quartosMin: "",
  vagasMin: "",
  suitesMin: "",
  areaMin: "",
  areaMax: "",
  precoMin: "",
  precoMax: "",
  portal: "todos",
};

type Props = {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  portais: string[];
  totalResults: number;
  filteredCount: number;
};

export function getEmptyFilters() {
  return { ...EMPTY_FILTERS };
}

export function ResultFilters({ filters, onChange, portais, totalResults, filteredCount }: Props) {
  const set = (key: keyof FilterState, val: string) => onChange({ ...filters, [key]: val });
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="w-4 h-4 text-primary" />
          Filtros
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filteredCount} de {totalResults} resultados
          </span>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => onChange(getEmptyFilters())} className="h-7 gap-1 text-xs">
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {/* Tipo */}
        <Select value={filters.tipo} onValueChange={v => set("tipo", v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="apartamento">Apartamento</SelectItem>
            <SelectItem value="casa">Casa</SelectItem>
            <SelectItem value="terreno">Terreno</SelectItem>
            <SelectItem value="comercial">Comercial</SelectItem>
            <SelectItem value="sala">Sala</SelectItem>
          </SelectContent>
        </Select>

        {/* Portal */}
        <Select value={filters.portal} onValueChange={v => set("portal", v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Portal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos portais</SelectItem>
            {portais.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Quartos min */}
        <Select value={filters.quartosMin || "none"} onValueChange={v => set("quartosMin", v === "none" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Quartos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Quartos</SelectItem>
            <SelectItem value="1">1+</SelectItem>
            <SelectItem value="2">2+</SelectItem>
            <SelectItem value="3">3+</SelectItem>
            <SelectItem value="4">4+</SelectItem>
          </SelectContent>
        </Select>

        {/* Vagas min */}
        <Select value={filters.vagasMin || "none"} onValueChange={v => set("vagasMin", v === "none" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Vagas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Vagas</SelectItem>
            <SelectItem value="1">1+</SelectItem>
            <SelectItem value="2">2+</SelectItem>
            <SelectItem value="3">3+</SelectItem>
          </SelectContent>
        </Select>

        {/* Área min */}
        <Input
          type="number"
          placeholder="Área mín m²"
          value={filters.areaMin}
          onChange={e => set("areaMin", e.target.value)}
          className="h-8 text-xs"
        />

        {/* Área max */}
        <Input
          type="number"
          placeholder="Área máx m²"
          value={filters.areaMax}
          onChange={e => set("areaMax", e.target.value)}
          className="h-8 text-xs"
        />

        {/* Preço min */}
        <Input
          type="number"
          placeholder="Preço mín R$"
          value={filters.precoMin}
          onChange={e => set("precoMin", e.target.value)}
          className="h-8 text-xs"
        />

        {/* Preço max */}
        <Input
          type="number"
          placeholder="Preço máx R$"
          value={filters.precoMax}
          onChange={e => set("precoMax", e.target.value)}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

export function applyFilters(items: any[], filters: FilterState) {
  return items.filter(im => {
    if (filters.tipo !== "todos" && im.tipo && !im.tipo.toLowerCase().includes(filters.tipo)) return false;
    if (filters.portal !== "todos" && im.portal !== filters.portal) return false;
    if (filters.quartosMin && im.quartos < parseInt(filters.quartosMin)) return false;
    if (filters.vagasMin && im.vagas < parseInt(filters.vagasMin)) return false;
    if (filters.areaMin && im.area < parseFloat(filters.areaMin)) return false;
    if (filters.areaMax && im.area > parseFloat(filters.areaMax)) return false;
    if (filters.precoMin && im.preco < parseFloat(filters.precoMin)) return false;
    if (filters.precoMax && im.preco > parseFloat(filters.precoMax)) return false;
    return true;
  });
}
