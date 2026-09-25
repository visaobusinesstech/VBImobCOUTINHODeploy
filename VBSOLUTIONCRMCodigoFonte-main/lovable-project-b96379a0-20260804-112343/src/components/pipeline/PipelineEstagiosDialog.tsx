import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GripVertical, Plus, Trash2, Pencil, Check, X, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePipelineEstagios, type PipelineEstagio } from "@/hooks/usePipelineEstagios";

const COLOR_PALETTE = [
  "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(262, 83%, 58%)", "hsl(142, 71%, 45%)",
  "hsl(210, 70%, 55%)", "hsl(25, 95%, 53%)", "hsl(180, 70%, 45%)", "hsl(0, 0%, 55%)",
  "hsl(45, 93%, 47%)", "hsl(15, 80%, 50%)", "hsl(0, 60%, 45%)", "hsl(0, 72%, 51%)",
  "hsl(340, 82%, 55%)", "hsl(160, 65%, 42%)", "hsl(280, 65%, 55%)",
];

function SortableRow({ e, onEdit, onToggle, onDelete }: {
  e: PipelineEstagio;
  onEdit: (e: PipelineEstagio) => void;
  onToggle: (e: PipelineEstagio) => void;
  onDelete: (e: PipelineEstagio) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: e.slug });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{e.title}</span>
          {e.is_sistema && (
            <Badge variant="secondary" className="text-[10px] gap-1"><Lock className="w-3 h-3" />sistema</Badge>
          )}
          {!e.ativo && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
        </div>
        <code className="text-[10px] text-muted-foreground">{e.slug}</code>
      </div>
      <div className="flex items-center gap-1">
        <Switch checked={e.ativo} onCheckedChange={() => onToggle(e)} aria-label="ativo" />
        <Button variant="ghost" size="icon" onClick={() => onEdit(e)} className="h-8 w-8"><Pencil className="w-3.5 h-3.5" /></Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(e)}
          disabled={e.is_sistema}
          className="h-8 w-8 text-destructive disabled:opacity-30"
          title={e.is_sistema ? "Estágio de sistema — não pode ser excluído" : "Excluir"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function PipelineEstagiosDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { todos, loading, create, update, remove, reorder } = usePipelineEstagios();
  const [novoTitle, setNovoTitle] = useState("");
  const [novoColor, setNovoColor] = useState(COLOR_PALETTE[0]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PipelineEstagio | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editColor, setEditColor] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PipelineEstagio | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const items = useMemo(() => [...todos].sort((a, b) => a.ordem - b.ordem), [todos]);

  const handleDragEnd = async (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.slug === active.id);
    const newIndex = items.findIndex((i) => i.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex).map((i) => i.slug);
    try {
      await reorder(next);
    } catch (e: any) {
      toast.error("Falha ao reordenar", { description: e?.message });
    }
  };

  const handleCreate = async () => {
    if (!novoTitle.trim()) return;
    setCreating(true);
    try {
      await create({ title: novoTitle.trim(), color: novoColor });
      setNovoTitle("");
      setNovoColor(COLOR_PALETTE[0]);
      toast.success("Estágio criado");
    } catch (e: any) {
      toast.error("Falha ao criar", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (e: PipelineEstagio) => {
    setEditing(e);
    setEditTitle(e.title);
    setEditColor(e.color);
  };

  const saveEdit = async () => {
    if (!editing || !editTitle.trim()) return;
    try {
      await update(editing.id, { title: editTitle.trim(), color: editColor });
      setEditing(null);
      toast.success("Estágio atualizado");
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e?.message });
    }
  };

  const toggleAtivo = async (e: PipelineEstagio) => {
    try {
      await update(e.id, { ativo: !e.ativo });
    } catch (err: any) {
      toast.error("Falha", { description: err?.message });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete.id);
      toast.success("Estágio excluído");
      setPendingDelete(null);
    } catch (e: any) {
      toast.error("Não foi possível excluir", { description: e?.message });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar pipeline</DialogTitle>
          </DialogHeader>

          {/* Create new */}
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <Label className="text-xs">Novo estágio</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={novoTitle}
                onChange={(e) => setNovoTitle(e.target.value)}
                placeholder="Ex.: Aguardando documentação"
                className="flex-1 min-w-[200px]"
                maxLength={40}
              />
              <div className="flex items-center gap-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNovoColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${novoColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                    aria-label={`cor ${c}`}
                  />
                ))}
              </div>
              <Button onClick={handleCreate} disabled={!novoTitle.trim() || creating} size="sm">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </Button>
            </div>
          </div>

          {/* List / sortable */}
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.slug)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {items.map((e) => (
                    <SortableRow key={e.slug} e={e} onEdit={startEdit} onToggle={toggleAtivo} onDelete={setPendingDelete} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <p className="text-[11px] text-muted-foreground">
            Arraste pelo <GripVertical className="inline w-3 h-3" /> para reordenar colunas. Estágios de sistema não podem ser excluídos porque disparam regras (fechamento, motivo de perda). Um estágio com leads também não pode ser excluído — mova-os antes.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar estágio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={40} />
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${editColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            {editing?.is_sistema && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> Estágio de sistema — o identificador ({editing.slug}) não pode ser alterado.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}><X className="w-4 h-4" />Cancelar</Button>
            <Button onClick={saveEdit} disabled={!editTitle.trim()}><Check className="w-4 h-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir estágio?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" será removido do pipeline. Se houver leads nele, a operação falhará — mova-os antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
