import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { enterAsCandidate, listCandidatesForSelect } from "@/lib/portal.functions";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar como candidato — TJRS" },
      {
        name: "description",
        content: "Selecione seu nome para acessar o portal do candidato.",
      },
      { property: "og:title", content: "Entrar como candidato — TJRS" },
      {
        property: "og:description",
        content: "Selecione seu nome para acessar o portal do candidato.",
      },
    ],
  }),
  component: EntrarPage,
});

function EntrarPage() {
  const navigate = useNavigate();
  const list = useServerFn(listCandidatesForSelect);
  const enter = useServerFn(enterAsCandidate);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["candidates-select"],
    queryFn: () => list(),
  });

  const selected = useMemo(
    () => data?.find((c) => c.id === selectedId) ?? null,
    [data, selectedId],
  );

  async function onEnter() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await enter({ data: { candidateId: selected.id } });
      toast.success(`Bem-vindo(a), ${selected.nome}`);
      navigate({ to: "/portal" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Entrar como candidato</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Selecione seu nome na lista abaixo. Apenas candidatos com Ordem de
        nomeação igual ou superior a 200 aparecem.
      </p>

      <div className="mt-8 rounded-lg border bg-card p-6 shadow-sm">
        <label className="text-sm font-medium text-foreground">Seu nome</label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="mt-2 w-full justify-between text-left font-normal"
              disabled={isLoading}
            >
              {selected ? (
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    #{selected.ordem_nomeacao}
                  </Badge>
                  <span className="truncate">{selected.nome}</span>
                </span>
              ) : isLoading ? (
                <span className="text-muted-foreground">Carregando lista…</span>
              ) : (
                <span className="text-muted-foreground">
                  Buscar candidato por nome ou ordem…
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(value, search) => {
                if (!search) return 1;
                return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="Digite nome ou ordem de nomeação…" />
              <CommandList>
                <CommandEmpty>Nenhum candidato encontrado.</CommandEmpty>
                <CommandGroup>
                  {(data ?? []).map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.ordem_nomeacao} ${c.nome}`}
                      onSelect={() => {
                        setSelectedId(c.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedId === c.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="mr-2 inline-flex w-14 justify-end font-mono text-xs text-muted-foreground">
                        #{c.ordem_nomeacao}
                      </span>
                      <span className="truncate">{c.nome}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={onEnter}
          disabled={!selected || submitting}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Atenção: neste momento o acesso é feito apenas pela seleção do nome.
          Confirme com cuidado — a resposta que você registrar será visível a
          todos.
        </p>
      </div>
    </div>
  );
}
