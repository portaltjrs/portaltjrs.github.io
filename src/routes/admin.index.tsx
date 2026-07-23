import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin } from "@/lib/portal.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Acesso administrativo — TJRS" },
      { name: "description", content: "Área restrita ao administrador." },
      { property: "og:title", content: "Acesso administrativo — TJRS" },
      { property: "og:description", content: "Área restrita ao administrador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await login({ data: { password } });
      if (res.ok) {
        toast.success("Autenticado");
        navigate({ to: "/admin/painel" });
      } else {
        toast.error("Senha incorreta");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 inline-flex rounded-md bg-primary/10 p-2 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Painel administrativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe a senha do administrador para continuar.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1"
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
