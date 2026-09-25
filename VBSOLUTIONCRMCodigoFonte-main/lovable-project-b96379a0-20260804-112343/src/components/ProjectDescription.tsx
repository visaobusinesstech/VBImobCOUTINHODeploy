import React from 'react';
import { PROJECT_METADATA } from '@/constants/projectMetadata';
import { 
  CheckCircle2, 
  Code2, 
  Layers, 
  Package, 
  Info,
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const ProjectDescription = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary">{PROJECT_METADATA.name}</h1>
        <p className="text-xl text-muted-foreground">{PROJECT_METADATA.description}</p>
        <div className="flex justify-center gap-2">
          <Badge variant="outline" className="text-xs">Versão {PROJECT_METADATA.version}</Badge>
          <Badge variant="secondary" className="text-xs">Status: Em Produção</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tecnologias */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code2 className="w-5 h-5 text-primary" />
              Stack Tecnológica
            </CardTitle>
            <CardDescription>Tecnologias modernas utilizadas no desenvolvimento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PROJECT_METADATA.technologies.map((tech) => (
                <Badge key={tech} variant="outline" className="bg-background">
                  {tech}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Módulos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Módulos do Sistema
            </CardTitle>
            <CardDescription>Funcionalidades principais por área</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {PROJECT_METADATA.modules.slice(0, 4).map((module) => (
                <li key={module.id} className="text-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold">{module.name}:</span>
                    <span className="text-muted-foreground ml-1">{module.description}</span>
                  </div>
                </li>
              ))}
              <li className="text-xs text-primary font-medium pl-6 pt-1">
                E mais {PROJECT_METADATA.modules.length - 4} módulos integrados...
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" />
          Diferenciais do Projeto
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROJECT_METADATA.features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Info className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-8 border-t text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Projeto desenvolvido para alta performance e escalabilidade no setor imobiliário.
        </p>
        <div className="flex justify-center gap-4">
          <a 
            href="https://lovable.dev" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs flex items-center gap-1 text-primary hover:underline"
          >
            Built with Lovable <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
