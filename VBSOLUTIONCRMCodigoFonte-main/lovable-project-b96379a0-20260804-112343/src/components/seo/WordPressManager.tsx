
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, Globe, ExternalLink, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export function WordPressManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imobiliariaId, setImobiliariaId] = useState<string | null>(null);

  const [newSite, setNewSite] = useState({
    name: "",
    base_url: "",
    username: "",
    application_password: "",
    seo_plugin: "none"
  });

  useEffect(() => {
    async function fetchConfig() {
      if (!user) return;
      const { data } = await supabase
        .from("imobiliaria_config")
        .select("id")
        .maybeSingle();
      
      if (data) {
        setImobiliariaId(data.id);
        fetchSites(data.id);
      }
    }
    fetchConfig();
  }, [user]);

  const fetchSites = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wordpress_sites")
      .select("*")
      .eq("imobiliaria_id", id);
    
    if (error) {
      toast({ title: "Erro ao buscar sites", description: error.message, variant: "destructive" });
    } else {
      setSites(data || []);
    }
    setLoading(false);
  };

  const handleAddSite = async () => {
    if (!imobiliariaId) return;
    if (!newSite.name || !newSite.base_url || !newSite.username || !newSite.application_password) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos do site.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("wordpress_sites")
      .insert({
        ...newSite,
        imobiliaria_id: imobiliariaId
      });

    if (error) {
      toast({ title: "Erro ao adicionar site", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Site adicionado!", description: "Conexão WordPress salva com sucesso." });
      setNewSite({ name: "", base_url: "", username: "", application_password: "", seo_plugin: "none" });
      fetchSites(imobiliariaId);
    }
    setSaving(false);
  };

  const handleDeleteSite = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este site?")) return;

    const { error } = await supabase
      .from("wordpress_sites")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setSites(sites.filter(s => s.id !== id));
      toast({ title: "Site removido" });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Adicionar Novo Site</CardTitle>
          <CardDescription>Configure a conexão com seu blog WordPress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-secondary/30 rounded-lg text-xs space-y-2">
            <p className="font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Como conectar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>No WP, vá em Usuários {">"} Perfil</li>
              <li>O usuário deve ser Editor ou Admin</li>
              <li>Use o <strong>E-mail</strong> no campo Usuário</li>
              <li>Crie uma "Senha de aplicação" no final da página</li>
              <li>Copie a senha e cole abaixo</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label>Nome do Site (ex: Meu Blog)</Label>
            <Input 
              value={newSite.name} 
              onChange={e => setNewSite({...newSite, name: e.target.value})} 
              placeholder="Ex: Imóveis Coutinho"
            />
          </div>
          <div className="space-y-2">
            <Label>URL Base (ex: https://meusite.com)</Label>
            <Input 
              value={newSite.base_url} 
              onChange={e => setNewSite({...newSite, base_url: e.target.value})} 
              placeholder="https://coutinhoimoveisdf.com.br"
            />
          </div>
          <div className="space-y-2">
            <Label>Usuário WordPress (E-mail)</Label>
            <Input 
              value={newSite.username} 
              onChange={e => setNewSite({...newSite, username: e.target.value})} 
              placeholder="admin@exemplo.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Senha de Aplicação</Label>
            <Input 
              type="password"
              value={newSite.application_password} 
              onChange={e => setNewSite({...newSite, application_password: e.target.value})} 
              placeholder="xxxx xxxx xxxx xxxx"
            />
          </div>
          <div className="space-y-2">
            <Label>Plugin SEO</Label>
            <Select 
              value={newSite.seo_plugin} 
              onValueChange={v => setNewSite({...newSite, seo_plugin: v})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plugin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (Padrão)</SelectItem>
                <SelectItem value="yoast">Yoast SEO</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Selecione se usar um plugin de SEO para preencher automaticamente Meta Title/Description.
            </p>
          </div>
          <Button onClick={handleAddSite} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar Site
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Sites Conectados</CardTitle>
          <CardDescription>Gerencie as conexões de blog ativas</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : sites.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum site WordPress conectado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>SEO</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map(site => (
                  <TableRow key={site.id}>
                    <TableCell className="font-medium">{site.name}</TableCell>
                    <TableCell>
                      <a href={site.base_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs hover:underline text-primary">
                        {site.base_url} <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell className="text-xs">{site.username}</TableCell>
                    <TableCell>
                      <span className="text-xs capitalize">{site.seo_plugin === 'none' ? 'Nenhum' : site.seo_plugin}</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSite(site.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
