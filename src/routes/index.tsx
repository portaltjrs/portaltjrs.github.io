import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TJRS · Portal de Chamada | Oficial de Justiça" },
      {
        name: "description",
        content:
          "Portal de acompanhamento e escolha de comarcas do concurso de Oficial de Justiça do TJRS.",
      },
    ],
  }),
  component: HomePortal,
});

function HomePortal() {
  return (
    <div className="w-full min-h-screen bg-[#0f172a]">
      <iframe
        src="/index.html"
        title="TJRS Portal de Chamada"
        className="w-full h-screen border-0"
        style={{ minHeight: "calc(100vh - 60px)", width: "100%" }}
      />
    </div>
  );
}
