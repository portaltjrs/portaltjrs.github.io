import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-primary/20 bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="rounded-md bg-primary-foreground/10 p-2">
            <Scale className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-primary-foreground/90">
              TJRS · Oficial de Justiça
            </div>
            <div className="text-base font-semibold leading-tight text-primary-foreground">
              Chamada e Escolha de Comarcas
            </div>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm font-medium">
          <NavItem to="/">Início</NavItem>
          <NavItem to="/fila">Fila pública</NavItem>
          <NavItem to="/entrar">Sou candidato</NavItem>
        </nav>
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-primary-foreground/90 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
      activeProps={{ className: "bg-primary-foreground/20 text-primary-foreground font-semibold" }}
      activeOptions={{ exact: true }}
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-muted/40 py-6 text-center text-xs text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4">
        Portal não-oficial de gestão da chamada de Oficiais de Justiça — TJRS.
        Dados alimentados por importação de planilha do administrador.
      </div>
    </footer>
  );
}
