import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getQueueSnapshot } from "@/lib/portal.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fila")({
  head: () => ({
    meta: [
      { title: "Fila pública — Chamada TJRS" },
      {
        name: "description",
        content:
          "Dashboard público com fila dinâmica, proporção de respostas e comarcas escolhidas.",
      },
      { property: "og:title", content: "Fila pública — Chamada TJRS" },
      {
        property: "og:description",
        content:
          "Fila dinâmica, proporções de resposta e status das comarcas em tempo real.",
      },
    ],
  }),
  component: FilaPublica,
});

const STATUS_LABELS: Record<string, string> = {
  sim: "Sim",
  nao: "Não",
  talvez: "Talvez",
  pendente: "Pendente",
};

const STATUS_COLORS: Record<string, string> = {
  sim: "var(--success)",
  talvez: "var(--warning)",
  nao: "var(--destructive)",
  pendente: "var(--muted-foreground)",
};

function FilaPublica() {
  const getQueue = useServerFn(getQueueSnapshot);
  const { data, isLoading } = useQuery({
    queryKey: ["queue"],
    queryFn: () => getQueue(),
    refetchInterval: 5000,
  });

  const pieData = useMemo(() => {
    if (!data) return [];
    return (["sim", "talvez", "pendente", "nao"] as const).map((k) => ({
      name: STATUS_LABELS[k],
      value: data.counters[k] ?? 0,
      color: STATUS_COLORS[k],
    }));
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fila pública</h1>
          <p className="text-sm text-muted-foreground">
            Dados atualizados a cada 5 segundos. A partir da ordem de nomeação 200.
          </p>
        </div>
        <FaseBadge fase={data?.fase ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sim" value={data?.counters.sim ?? 0} color="text-success" />
        <StatCard
          label="Talvez"
          value={data?.counters.talvez ?? 0}
          color="text-warning"
        />
        <StatCard
          label="Não"
          value={data?.counters.nao ?? 0}
          color="text-destructive"
        />
        <StatCard
          label="Pendente"
          value={data?.counters.pendente ?? 0}
          color="text-muted-foreground"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Proporção de respostas</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {pieData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Comarcas</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.comarcas.length ?? 0) === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma comarca cadastrada.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comarca</TableHead>
                    <TableHead className="text-right">Vagas</TableHead>
                    <TableHead className="text-right">Ocupadas</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.comarcas.map((c) => {
                    const restantes = c.vagas_total - c.vagas_ocupadas;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-right">{c.vagas_total}</TableCell>
                        <TableCell className="text-right">{c.vagas_ocupadas}</TableCell>
                        <TableCell className="text-right">
                          {restantes > 0 ? (
                            <Badge variant="outline" className="border-success/40 text-success">
                              {restantes} vaga(s)
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Esgotada</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Fila dinâmica (a partir do #200)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Candidatos com resposta "NÃO" aparecem riscados e são pulados. Próximo
            a escolher destacado em azul.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : (data?.queue.length ?? 0) === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Nenhum candidato importado ainda.
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-20">Ordem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-24">Cota</TableHead>
                    <TableHead className="w-28">Intenção</TableHead>
                    <TableHead>Comarca escolhida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.queue.map((c) => {
                    const isNext = c.id === data!.currentTurnId;
                    const isNao = c.status === "nao";
                    return (
                      <TableRow
                        key={c.id}
                        className={cn(
                          isNext && "bg-primary/10 hover:bg-primary/15",
                          isNao && "opacity-60",
                        )}
                      >
                        <TableCell className="font-mono">
                          #{c.ordem_nomeacao}
                          {isNext && (
                            <div className="text-[10px] font-semibold uppercase text-primary">
                              a escolher
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={cn(isNao && "line-through")}>
                          {c.nome}
                        </TableCell>
                        <TableCell className="uppercase text-xs">
                          {c.cota}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.comarca_nome ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-3xl font-bold", color)}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    sim: { label: "Sim", className: "bg-success text-success-foreground" },
    nao: { label: "Não", className: "bg-destructive text-destructive-foreground" },
    talvez: { label: "Talvez", className: "bg-warning text-warning-foreground" },
    pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  };
  const v = map[status] ?? map.pendente;
  return <Badge className={cn("uppercase", v.className)}>{v.label}</Badge>;
}

function FaseBadge({ fase }: { fase: number }) {
  const map: Record<number, { label: string; cls: string }> = {
    0: { label: "Chamada fechada", cls: "bg-muted text-muted-foreground" },
    1: { label: "Fase 1 — Intenção", cls: "bg-primary text-primary-foreground" },
    2: { label: "Fase 2 — Escolha de comarca", cls: "bg-primary text-primary-foreground" },
  };
  const v = map[fase] ?? map[0];
  return <Badge className={v.cls}>{v.label}</Badge>;
}
