import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ListOrdered, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TJRS — Chamada e escolha de comarcas" },
      {
        name: "description",
        content:
          "Portal de acompanhamento da chamada de aprovados no concurso de Oficial de Justiça do TJRS, a partir da posição 200.",
      },
      { property: "og:title", content: "TJRS — Chamada e escolha de comarcas" },
      {
        property: "og:description",
        content:
          "Fila dinâmica, intenção de posse e escolha de comarcas em tempo real.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div>
      <section className="bg-gradient-to-b from-primary/10 to-transparent">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Concurso Oficial de Justiça — TJRS
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Chamada e escolha de comarcas
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Portal para gerenciar, com transparência, a intenção de posse e a
              escolha de comarcas dos candidatos aprovados a partir da{" "}
              <strong className="text-foreground">posição 200</strong>. A fila é atualizada em tempo real
              conforme os candidatos respondem.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/entrar"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Sou candidato <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/fila"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-accent"
              >
                Ver fila pública
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Intenção de posse"
            desc="Marque SIM, NÃO ou TALVEZ enquanto a fase de intenção estiver aberta."
          />
          <FeatureCard
            icon={<ListOrdered className="h-5 w-5" />}
            title="Fila dinâmica"
            desc="Quem responde NÃO é pulado automaticamente. Você vê sua posição real."
          />
          <FeatureCard
            icon={<MapPin className="h-5 w-5" />}
            title="Escolha de comarca"
            desc="Quando for a sua vez, escolha entre as comarcas com vagas disponíveis."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm transition-all hover:border-primary/30">
      <div className="mb-3 inline-flex rounded-md bg-primary/10 p-2 text-primary">
        {icon}
      </div>
      <div className="text-sm font-bold text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}
