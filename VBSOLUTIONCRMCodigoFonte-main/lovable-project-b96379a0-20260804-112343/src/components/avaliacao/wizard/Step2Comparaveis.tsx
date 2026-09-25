import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import type { ComparavelInput } from "@/lib/avaliacao/engine";

interface Props {
  comparaveis: ComparavelInput[];
  onChange: (next: ComparavelInput[]) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const emptyComparavel = (): ComparavelInput => ({
  id: crypto.randomUUID(),
  endereco: "",
  bairro: "",
  area: 0,
  valor_anunciado: 0,
  valor_negociado: 0,
  distancia_km: 0,
  data_pesquisa: new Date().toISOString().slice(0, 10),
  link_fonte: "",
  observacoes: "",
});

export function Step2Comparaveis({ comparaveis, onChange }: Props) {
  const [editing, setEditing] = useState<ComparavelInput>(emptyComparavel());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const reset = () => {
    setEditing(emptyComparavel());
    setEditingIdx(null);
  };

  const save = () => {
    if (!editing.area || !editing.valor_anunciado) return;
    if (editingIdx !== null) {
      const next = [...comparaveis];
      next[editingIdx] = editing;
      onChange(next);
    } else {
      onChange([...comparaveis, editing]);
    }
    reset();
  };

  const remove = (id: string) => onChange(comparaveis.filter((c) => c.id !== id));
  const edit = (idx: number) => {
    setEditing(comparaveis[idx]);
    setEditingIdx(idx);
  };

  const insuficiente = comparaveis.length < 3;

  return (
    <div className="space-y-5">
      {insuficiente && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          Mínimo de 3 comparáveis recomendado pela NBR 14.653 (atual: {comparaveis.length}).
        </div>
      )}

      <Card className="border-primary/30">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {editingIdx !== null ? `Editando comparável #${editingIdx + 1}` : "Adicionar comparável"}
            </h3>
            {editingIdx !== null && (
              <Button variant="ghost" size="sm" onClick={reset}>Cancelar edição</Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Endereço</Label>
              <Input value={editing.endereco || ""} onChange={(e) => setEditing({ ...editing, endereco: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Input value={editing.bairro || ""} onChange={(e) => setEditing({ ...editing, bairro: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Área (m²) *</Label>
              <Input inputMode="decimal" value={editing.area || ""} onChange={(e) => setEditing({ ...editing, area: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor anunciado (R$) *</Label>
              <Input inputMode="decimal" value={editing.valor_anunciado || ""} onChange={(e) => setEditing({ ...editing, valor_anunciado: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor negociado (R$)</Label>
              <Input inputMode="decimal" value={editing.valor_negociado || ""} onChange={(e) => setEditing({ ...editing, valor_negociado: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Distância (km)</Label>
              <Input inputMode="decimal" value={editing.distancia_km || ""} onChange={(e) => setEditing({ ...editing, distancia_km: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data da pesquisa</Label>
              <Input type="date" value={editing.data_pesquisa || ""} onChange={(e) => setEditing({ ...editing, data_pesquisa: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Link da fonte</Label>
              <Input value={editing.link_fonte || ""} onChange={(e) => setEditing({ ...editing, link_fonte: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
            </div>
          </div>
          <Button onClick={save} disabled={!editing.area || !editing.valor_anunciado} className="gap-2">
            <Plus className="w-4 h-4" /> {editingIdx !== null ? "Salvar alterações" : "Adicionar comparável"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Comparáveis cadastrados</h3>
          <Badge variant="outline">{comparaveis.length}</Badge>
        </div>
        {comparaveis.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhum comparável cadastrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Endereço / Bairro</th>
                  <th className="text-right p-2">Área</th>
                  <th className="text-right p-2">Valor anunciado</th>
                  <th className="text-right p-2">Valor negociado</th>
                  <th className="text-right p-2">R$/m²</th>
                  <th className="text-right p-2">Dist.</th>
                  <th className="text-center p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {comparaveis.map((c, i) => {
                  const v = c.valor_negociado || c.valor_anunciado;
                  const pm2 = c.area > 0 ? v / c.area : 0;
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">
                        <div className="font-medium">{c.endereco || "—"}</div>
                        <div className="text-muted-foreground">{c.bairro || "—"}</div>
                      </td>
                      <td className="p-2 text-right">{c.area} m²</td>
                      <td className="p-2 text-right">{fmt(c.valor_anunciado)}</td>
                      <td className="p-2 text-right">{c.valor_negociado ? fmt(c.valor_negociado) : "—"}</td>
                      <td className="p-2 text-right font-medium">{fmt(pm2)}</td>
                      <td className="p-2 text-right">{c.distancia_km ? `${c.distancia_km} km` : "—"}</td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          {c.link_fonte && (
                            <a href={c.link_fonte} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => edit(i)}>Editar</Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => remove(c.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
