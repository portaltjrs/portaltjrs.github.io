import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, HelpCircle, LogOut, MapPin, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  chooseComarca,
  getMyCandidate,
  getQueueSnapshot,
  logoutCandidate,
  setIntent,
} from "@/lib/portal.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal do candidato — TJRS" },
      {
        name: "description",
        content: "Registre sua intenção de posse e escolha sua comarca.",
      },
      { property: "og:title", content: "Portal do candidato — TJRS" },
      {
        property: "og:description",
        content: "Registre sua intenção de posse e escolha sua comarca.",
      },
    ],
  }),
  component: Portal,
});

function Portal() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getMy = useServerFn(getMyCandidate);
  const getQueue = useServerFn(getQueueSnapshot);
  const logout = useServerFn(logoutCandidate);
  const setIntentFn = useServerFn(setIntent);
  const chooseFn = useServerFn(chooseComarca);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => getMy(),
    refetchInterval: 5000,
  });
  const queueQuery = useQuery({
    queryKey: ["queue"],
    queryFn: () => getQueue(),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (meQuery.data === null && !meQuery.isLoading) {
      navigate({ to: "/entrar" });
    }
  }, [meQuery.data, meQuery.isLoading, navigate]);

  const intentMut = useMutation({
    mutationFn: (status: "sim" | "nao" | "talvez") => setIntentFn({ data: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success("Resposta registrada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const chooseMut = useMutation({
    mutationFn: (comarcaId: string) => chooseFn({ data: { comarcaId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success("Comarca confirmada!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  async function onLogout() {
    await logout();
    qc.clear();
    navigate({ to: "/" });
  }

  if (meQuery.isLoading || !meQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const me = meQuery.data;
  const snap = queueQuery.data;
  const fase = snap?.fase ?? 0;

  // Posição efetiva na fila (contando apenas quem ainda pode escolher)
  const effectivePosition = snap
    ? snap.queue
        .filter((c) => c.status !== "nao" && c.comarca_id === null)
        .findIndex((c) => c.id === me.id) + 1
    : 0;

  const isMyTurn = snap?.currentTurnId === me.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Portal do candidato
          </div>
          <h1 className="text-2xl font-bold text-foreground">{me.nome}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="secondary" className="font-mono">
              Ordem #{me.ordem_nomeacao}
            </Badge>
            {me.classificacao != null && (
              <Badge variant="outline">Classificação: {me.classificacao}º</Badge>
            )}
            <Badge variant="outline" className="uppercase">{me.cota}</Badge>
          </div>
        </div>
        <Button variant="outline" onClick={onLogout} size="sm">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>

      {me.comarca_nome && (
        <Card className="mt-6 border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <div>
              <div className="text-sm font-semibold text-foreground">
                Comarca confirmada
              </div>
              <div className="text-sm text-muted-foreground">
                Você assumiu <strong>{me.comarca_nome}</strong>. Boa sorte!
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!me.comarca_nome && fase === 0 && (
        <Card className="mt-6">
          <CardContent className="py-8 text-center">
            <HelpCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <div className="text-base font-medium text-foreground">
              A chamada ainda não está aberta
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Aguarde o administrador abrir a Fase 1 (intenção de posse).
            </div>
          </CardContent>
        </Card>
      )}

      {!me.comarca_nome && fase === 1 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Fase 1 — Intenção de posse</CardTitle>
            <p className="text-sm text-muted-foreground">
              Você tem intenção de assumir a vaga nesta chamada? Você pode
              alterar sua resposta a qualquer momento enquanto esta fase estiver
              aberta.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <IntentButton
                label="SIM"
                sub="Quero assumir"
                active={me.status === "sim"}
                color="success"
                onClick={() => intentMut.mutate("sim")}
                loading={intentMut.isPending}
              />
              <IntentButton
                label="TALVEZ"
                sub="Ainda decidindo"
                active={me.status === "talvez"}
                color="warning"
                onClick={() => intentMut.mutate("talvez")}
                loading={intentMut.isPending}
              />
              <IntentButton
                label="NÃO"
                sub="Desisto desta chamada"
                active={me.status === "nao"}
                color="destructive"
                onClick={() => intentMut.mutate("nao")}
                loading={intentMut.isPending}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Status atual:{" "}
              <span className="font-medium uppercase text-foreground">
                {me.status}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {!me.comarca_nome && fase === 2 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Fase 2 — Escolha da comarca
            </CardTitle>
            {me.status === "nao" ? (
              <p className="text-sm text-destructive">
                Você marcou <strong>NÃO</strong> na fase de intenção. Não é
                possível escolher comarca.
              </p>
            ) : isMyTurn ? (
              <p className="text-sm font-medium text-success">
                É a sua vez! Escolha uma comarca abaixo.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você é o <strong>Nº {effectivePosition}</strong> da fila
                efetiva. Aguarde os candidatos anteriores escolherem.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {(snap?.comarcas ?? []).map((c) => {
                const restantes = c.vagas_total - c.vagas_ocupadas;
                const esgotada = restantes <= 0;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm",
                      esgotada && "opacity-50",
                    )}
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {c.nome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {restantes} de {c.vagas_total} vaga(s) disponível(is)
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={
                        !isMyTurn ||
                        esgotada ||
                        chooseMut.isPending ||
                        me.status === "nao"
                      }
                      onClick={() => {
                        if (
                          confirm(
                            `Confirmar escolha da comarca "${c.nome}"? Esta ação não pode ser desfeita.`,
                          )
                        ) {
                          chooseMut.mutate(c.id);
                        }
                      }}
                    >
                      {isMyTurn ? "Confirmar escolha" : "Aguarde sua vez"}
                    </Button>
                  </div>
                );
              })}
              {snap?.comarcas.length === 0 && (
                <div className="col-span-full rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Nenhuma comarca cadastrada ainda.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 text-center">
        <Link
          to="/fila"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ver fila pública e transparência →
        </Link>
      </div>
    </div>
  );
}

function IntentButton({
  label,
  sub,
  active,
  color,
  onClick,
  loading,
}: {
  label: string;
  sub: string;
  active: boolean;
  color: "success" | "warning" | "destructive";
  onClick: () => void;
  loading: boolean;
}) {
  const colorMap = {
    success: {
      border: "border-success",
      bg: "bg-success text-success-foreground",
      hover: "hover:bg-success/10",
    },
    warning: {
      border: "border-warning",
      bg: "bg-warning text-warning-foreground",
      hover: "hover:bg-warning/10",
    },
    destructive: {
      border: "border-destructive",
      bg: "bg-destructive text-destructive-foreground",
      hover: "hover:bg-destructive/10",
    },
  }[color];
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex flex-col items-center rounded-lg border-2 p-6 transition-all",
        active ? cn(colorMap.border, colorMap.bg) : cn("border-input bg-card", colorMap.hover),
        loading && "opacity-60",
      )}
    >
      <div className="text-2xl font-bold">{label}</div>
      <div className={cn("mt-1 text-xs", active ? "opacity-90" : "text-muted-foreground")}>
        {sub}
      </div>
      {active && (
        <div className="mt-2 flex items-center gap-1 text-xs opacity-90">
          <CheckCircle2 className="h-3 w-3" /> selecionado
        </div>
      )}
    </button>
  );
}

// Suppress unused warnings for icons
void XCircle;
