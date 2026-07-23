import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, LogOut, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminCheck,
  adminExportFinalCsv,
  adminImportCandidatesCsv,
  adminImportComarcasCsv,
  adminLogout,
  adminReleaseComarca,
  adminSetCandidateStatus,
  adminSetFase,
  getQueueSnapshot,
} from "@/lib/portal.functions";

export const Route = createFileRoute("/admin/painel")({
  head: () => ({
    meta: [
      { title: "Painel do administrador — TJRS" },
      { name: "description", content: "Gestão da chamada e das comarcas." },
      { property: "og:title", content: "Painel do administrador — TJRS" },
      { property: "og:description", content: "Gestão da chamada e das comarcas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const check = useServerFn(adminCheck);
  const getQueue = useServerFn(getQueueSnapshot);
  const setFase = useServerFn(adminSetFase);
  const importCand = useServerFn(adminImportCandidatesCsv);
  const importCom = useServerFn(adminImportComarcasCsv);
  const exportCsv = useServerFn(adminExportFinalCsv);
  const logout = useServerFn(adminLogout);
  const setStatus = useServerFn(adminSetCandidateStatus);
  const releaseCom = useServerFn(adminReleaseComarca);

  const authQuery = useQuery({ queryKey: ["admin-auth"], queryFn: () => check() });
  useEffect(() => {
    if (authQuery.data && !authQuery.data.authenticated) {
      navigate({ to: "/admin" });
    }
  }, [authQuery.data, navigate]);

  const queueQuery = useQuery({
    queryKey: ["queue"],
    queryFn: () => getQueue(),
    refetchInterval: 5000,
    enabled: authQuery.data?.authenticated === true,
  });

  const faseMut = useMutation({
    mutationFn: (f: 0 | 1 | 2) => setFase({ data: { fase: f } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success("Fase atualizada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const candFileRef = useRef<HTMLInputElement>(null);
  const comFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function onImport(kind: "cand" | "com", file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const csv = await file.text();
      const res =
        kind === "cand"
          ? await importCand({ data: { csv } })
          : await importCom({ data: { csv } });
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success(`Importados: ${res.imported}${res.errors.length ? ` · ${res.errors.length} erro(s)` : ""}`);
      if (res.errors.length) console.warn(res.errors);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setImporting(false);
      if (candFileRef.current) candFileRef.current.value = "";
      if (comFileRef.current) comFileRef.current.value = "";
    }
  }

  async function onExport() {
    try {
      const csv = await exportCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chamada-tjrs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onLogout() {
    await logout();
    qc.clear();
    navigate({ to: "/admin" });
  }

  if (!authQuery.data?.authenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        Verificando acesso…
      </div>
    );
  }

  const snap = queueQuery.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Área restrita
          </div>
          <h1 className="text-2xl font-bold text-foreground">Painel administrativo</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Controle de fase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Fase atual: <Badge>{faseLabel(snap?.fase ?? 0)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={snap?.fase === 0 ? "default" : "outline"}
                size="sm"
                onClick={() => faseMut.mutate(0)}
                disabled={faseMut.isPending}
              >
                Fechar
              </Button>
              <Button
                variant={snap?.fase === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => faseMut.mutate(1)}
                disabled={faseMut.isPending}
              >
                Fase 1 · Intenção
              </Button>
              <Button
                variant={snap?.fase === 2 ? "default" : "outline"}
                size="sm"
                onClick={() => faseMut.mutate(2)}
                disabled={faseMut.isPending}
              >
                Fase 2 · Escolha
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importar candidatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              CSV com colunas: <code>Classificação</code>, <code>Ordem nomeação</code>,{" "}
              <code>PCD</code>, <code>PNE</code>, <code>NOME</code>, e opcionalmente{" "}
              <code>LP</code>, <code>CE</code>, <code>MI</code>, <code>TOTAL</code>,{" "}
              <code>SITUAÇÃO</code>.
            </p>
            <input
              ref={candFileRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
              onChange={(e) => onImport("cand", e.target.files?.[0] ?? null)}
              disabled={importing}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importar comarcas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              CSV com colunas: <code>nome</code>, <code>vagas_total</code>.
            </p>
            <input
              ref={comFileRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
              onChange={(e) => onImport("com", e.target.files?.[0] ?? null)}
              disabled={importing}
            />
            {importing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Importando…
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" /> Exportar relatório final (CSV)
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Candidatos (posição ≥ 200)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ajuste manual do status, se necessário, e liberação de comarcas.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-20">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24">Cota</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead>Comarca</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(snap?.queue ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono">#{c.ordem_nomeacao}</TableCell>
                    <TableCell>{c.nome}</TableCell>
                    <TableCell className="uppercase text-xs">{c.cota}</TableCell>
                    <TableCell>
                      <Select
                        value={c.status}
                        onValueChange={(v) => {
                          setStatus({
                            data: {
                              id: c.id,
                              status: v as "pendente" | "sim" | "nao" | "talvez",
                            },
                          })
                            .then(() =>
                              qc.invalidateQueries({ queryKey: ["queue"] }),
                            )
                            .catch((e) =>
                              toast.error(e instanceof Error ? e.message : "Erro"),
                            );
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="talvez">Talvez</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{c.comarca_nome ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {c.comarca_nome && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (
                              confirm(
                                `Liberar a comarca de ${c.nome}? A vaga voltará a ficar disponível.`,
                              )
                            ) {
                              releaseCom({ data: { candidateId: c.id } })
                                .then(() =>
                                  qc.invalidateQueries({ queryKey: ["queue"] }),
                                )
                                .catch((e) =>
                                  toast.error(
                                    e instanceof Error ? e.message : "Erro",
                                  ),
                                );
                            }
                          }}
                        >
                          Liberar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function faseLabel(f: number) {
  if (f === 1) return "Fase 1 · Intenção";
  if (f === 2) return "Fase 2 · Escolha";
  return "Fechada";
}

// Suppress unused warnings
void Upload;
