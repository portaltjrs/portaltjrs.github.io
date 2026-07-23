import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CANDIDATE_SESSION_NAME = "tjrs-candidate";
const ADMIN_SESSION_NAME = "tjrs-admin";

type CandidateSessionData = { candidateId?: string };
type AdminSessionData = { authenticated?: boolean };

function candidateSessionConfig() {
  return {
    password: process.env.CANDIDATE_SESSION_SECRET!,
    name: CANDIDATE_SESSION_NAME,
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function adminSessionConfig() {
  return {
    password: process.env.ADMIN_SESSION_SECRET!,
    name: ADMIN_SESSION_NAME,
    maxAge: 60 * 60 * 4,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

// ---------------------------------------------------------------------------
// PUBLIC
// ---------------------------------------------------------------------------

export const listCandidatesForSelect = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("candidates")
      .select("id, nome, ordem_nomeacao, cota")
      .gte("ordem_nomeacao", 200)
      .order("ordem_nomeacao", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getQueueSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [candRes, comRes, setRes] = await Promise.all([
    supabaseAdmin
      .from("candidates")
      .select(
        "id, nome, ordem_nomeacao, classificacao, cota, status, comarca_id",
      )
      .gte("ordem_nomeacao", 200)
      .order("ordem_nomeacao", { ascending: true }),
    supabaseAdmin
      .from("comarcas")
      .select("id, nome, vagas_total, vagas_ocupadas")
      .order("nome", { ascending: true }),
    supabaseAdmin.from("settings").select("fase").eq("id", 1).single(),
  ]);
  if (candRes.error) throw new Error(candRes.error.message);
  if (comRes.error) throw new Error(comRes.error.message);
  if (setRes.error) throw new Error(setRes.error.message);

  const comarcasById = new Map(comRes.data!.map((c) => [c.id, c]));
  const queue = candRes.data!.map((c) => ({
    ...c,
    comarca_nome: c.comarca_id ? comarcasById.get(c.comarca_id)?.nome ?? null : null,
  }));

  // "Vez atual" = primeiro da fila (ordem asc) que não escolheu ainda
  // e não marcou "não". Talvez e pendente ainda são "esperados"; se quiser
  // pular também talvez/pendente, ajustar aqui.
  const currentTurn =
    queue.find(
      (c) =>
        c.comarca_id === null &&
        c.status !== "nao",
    ) ?? null;

  const counters = queue.reduce(
    (acc, c) => {
      acc[c.status] += 1;
      return acc;
    },
    { pendente: 0, sim: 0, nao: 0, talvez: 0 } as Record<string, number>,
  );

  return {
    fase: setRes.data!.fase,
    queue,
    comarcas: comRes.data!,
    currentTurnId: currentTurn?.id ?? null,
    counters,
  };
});

// ---------------------------------------------------------------------------
// CANDIDATE SESSION
// ---------------------------------------------------------------------------

export const enterAsCandidate = createServerFn({ method: "POST" })
  .inputValidator((data: { candidateId: string }) =>
    z.object({ candidateId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { useSession } = await import("@tanstack/react-start/server");
    const { data: cand, error } = await supabaseAdmin
      .from("candidates")
      .select("id, ordem_nomeacao")
      .eq("id", data.candidateId)
      .single();
    if (error || !cand) throw new Error("Candidato não encontrado");
    if (cand.ordem_nomeacao < 200) throw new Error("Candidato fora da chamada atual");
    const session = await useSession<CandidateSessionData>(candidateSessionConfig());
    await session.update({ candidateId: cand.id });
    return { ok: true };
  });

export const getMyCandidate = createServerFn({ method: "GET" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<CandidateSessionData>(candidateSessionConfig());
  if (!session.data.candidateId) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cand } = await supabaseAdmin
    .from("candidates")
    .select(
      "id, nome, ordem_nomeacao, classificacao, cota, status, comarca_id, notas",
    )
    .eq("id", session.data.candidateId)
    .single();
  if (!cand) return null;
  let comarcaNome: string | null = null;
  if (cand.comarca_id) {
    const { data: com } = await supabaseAdmin
      .from("comarcas")
      .select("nome")
      .eq("id", cand.comarca_id)
      .single();
    comarcaNome = com?.nome ?? null;
  }
  return { ...cand, comarca_nome: comarcaNome };
});

export const logoutCandidate = createServerFn({ method: "POST" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<CandidateSessionData>(candidateSessionConfig());
  await session.clear();
  return { ok: true };
});

export const setIntent = createServerFn({ method: "POST" })
  .inputValidator((data: { status: "sim" | "nao" | "talvez" }) =>
    z.object({ status: z.enum(["sim", "nao", "talvez"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const session = await useSession<CandidateSessionData>(candidateSessionConfig());
    if (!session.data.candidateId) throw new Error("Sessão inválida");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("fase")
      .eq("id", 1)
      .single();
    if (settings?.fase !== 1) throw new Error("A fase de intenção não está aberta");
    const { data: cand } = await supabaseAdmin
      .from("candidates")
      .select("id, comarca_id")
      .eq("id", session.data.candidateId)
      .single();
    if (!cand) throw new Error("Candidato não encontrado");
    if (cand.comarca_id) throw new Error("Você já escolheu uma comarca");
    const { error } = await supabaseAdmin
      .from("candidates")
      .update({ status: data.status })
      .eq("id", session.data.candidateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const chooseComarca = createServerFn({ method: "POST" })
  .inputValidator((data: { comarcaId: string }) =>
    z.object({ comarcaId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const session = await useSession<CandidateSessionData>(candidateSessionConfig());
    if (!session.data.candidateId) throw new Error("Sessão inválida");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("fase")
      .eq("id", 1)
      .single();
    if (settings?.fase !== 2) throw new Error("A fase de escolha não está aberta");

    // Confirma que o candidato é a vez atual
    const { data: queue } = await supabaseAdmin
      .from("candidates")
      .select("id, ordem_nomeacao, status, comarca_id")
      .gte("ordem_nomeacao", 200)
      .order("ordem_nomeacao", { ascending: true });
    if (!queue) throw new Error("Erro ao ler fila");
    const currentTurn = queue.find(
      (c) => c.comarca_id === null && c.status !== "nao",
    );
    if (!currentTurn) throw new Error("Fila vazia");
    if (currentTurn.id !== session.data.candidateId)
      throw new Error("Ainda não é a sua vez");

    const { data: rpcData, error } = await supabaseAdmin.rpc("choose_comarca", {
      _candidate_id: session.data.candidateId,
      _comarca_id: data.comarcaId,
    });
    if (error) throw new Error(error.message);
    const res = rpcData as { ok: boolean; error?: string };
    if (!res.ok) throw new Error(res.error ?? "Falha ao escolher comarca");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

async function requireAdminSession() {
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<AdminSessionData>(adminSessionConfig());
  if (!session.data.authenticated) throw new Error("Acesso negado");
  return session;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) =>
    z.object({ password: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("Senha do admin não configurada no servidor");
    // Timing-safe compare
    const a = new TextEncoder().encode(data.password);
    const b = new TextEncoder().encode(expected);
    let diff = a.length ^ b.length;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    if (diff !== 0) return { ok: false as const };
    const { useSession } = await import("@tanstack/react-start/server");
    const session = await useSession<AdminSessionData>(adminSessionConfig());
    await session.update({ authenticated: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<AdminSessionData>(adminSessionConfig());
  await session.clear();
  return { ok: true };
});

export const adminCheck = createServerFn({ method: "GET" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<AdminSessionData>(adminSessionConfig());
  return { authenticated: !!session.data.authenticated };
});

export const adminSetFase = createServerFn({ method: "POST" })
  .inputValidator((data: { fase: 0 | 1 | 2 }) =>
    z.object({ fase: z.union([z.literal(0), z.literal(1), z.literal(2)]) }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("settings")
      .update({ fase: data.fase })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetCandidateStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id: string; status: "pendente" | "sim" | "nao" | "talvez" }) =>
      z
        .object({
          id: z.string().uuid(),
          status: z.enum(["pendente", "sim", "nao", "talvez"]),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("candidates")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReleaseComarca = createServerFn({ method: "POST" })
  .inputValidator((data: { candidateId: string }) =>
    z.object({ candidateId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cand } = await supabaseAdmin
      .from("candidates")
      .select("comarca_id")
      .eq("id", data.candidateId)
      .single();
    if (!cand?.comarca_id) return { ok: true };
    const { data: com } = await supabaseAdmin
      .from("comarcas")
      .select("vagas_ocupadas")
      .eq("id", cand.comarca_id)
      .single();
    if (com) {
      await supabaseAdmin
        .from("comarcas")
        .update({ vagas_ocupadas: Math.max(0, com.vagas_ocupadas - 1) })
        .eq("id", cand.comarca_id);
    }
    await supabaseAdmin
      .from("candidates")
      .update({ comarca_id: null })
      .eq("id", data.candidateId);
    return { ok: true };
  });

export const adminImportCandidatesCsv = createServerFn({ method: "POST" })
  .inputValidator((data: { csv: string }) =>
    z.object({ csv: z.string().min(1).max(2_000_000) }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { parseCsv, normalizeHeader } = await import("@/lib/csv");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = parseCsv(data.csv);
    if (rows.length < 2) throw new Error("CSV vazio");
    const headers = rows[0].map(normalizeHeader);
    const idx = (name: string) => headers.indexOf(name);

    const iClass = idx("classificacao");
    const iOrdem = idx("ordem_nomeacao");
    const iPcd = idx("pcd");
    const iPne = idx("pne");
    const iNome = idx("nome");
    const iLp = idx("lp");
    const iCe = idx("ce");
    const iMi = idx("mi");
    const iTotal = idx("total");
    const iSit = idx("situacao");
    const iPret = idx("pretende_assumir");
    const iPref = idx("preferencia_local_regiao");

    if (iOrdem < 0 || iNome < 0) {
      throw new Error(
        "CSV precisa das colunas 'Ordem nomeação' e 'NOME'. Colunas encontradas: " +
          headers.join(", "),
      );
    }

    let imported = 0;
    const errors: string[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const nome = row[iNome]?.trim();
      const ordemRaw = row[iOrdem]?.trim();
      const ordem = parseInt(ordemRaw ?? "", 10);
      if (!nome || Number.isNaN(ordem)) continue;

      const isPcd = iPcd >= 0 && /sim/i.test(row[iPcd] ?? "");
      const isPne = iPne >= 0 && /sim/i.test(row[iPne] ?? "");
      const cota: "ampla" | "pcd" | "pne" = isPcd ? "pcd" : isPne ? "pne" : "ampla";

      const classificacao = iClass >= 0 ? parseInt(row[iClass] ?? "", 10) : null;
      const notas = {
        lp: iLp >= 0 ? Number(row[iLp]) : null,
        ce: iCe >= 0 ? Number(row[iCe]) : null,
        mi: iMi >= 0 ? Number(row[iMi]) : null,
        total: iTotal >= 0 ? Number(row[iTotal]) : null,
      };

      const { error } = await supabaseAdmin
        .from("candidates")
        .upsert(
          {
            ordem_nomeacao: ordem,
            nome,
            cota,
            classificacao: Number.isNaN(classificacao as number)
              ? null
              : classificacao,
            notas,
            situacao_original: iSit >= 0 ? row[iSit] ?? null : null,
            pretende_original: iPret >= 0 ? row[iPret] ?? null : null,
            preferencia_original: iPref >= 0 ? row[iPref] ?? null : null,
          },
          { onConflict: "ordem_nomeacao" },
        );
      if (error) errors.push(`Linha ${r + 1}: ${error.message}`);
      else imported++;
    }

    return { imported, errors };
  });

export const adminImportComarcasCsv = createServerFn({ method: "POST" })
  .inputValidator((data: { csv: string }) =>
    z.object({ csv: z.string().min(1).max(500_000) }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { parseCsv, normalizeHeader } = await import("@/lib/csv");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = parseCsv(data.csv);
    if (rows.length < 2) throw new Error("CSV vazio");
    const headers = rows[0].map(normalizeHeader);
    const iNome = headers.indexOf("nome");
    const iVagas = headers.indexOf("vagas_total");
    if (iNome < 0 || iVagas < 0)
      throw new Error("CSV de comarcas precisa das colunas 'nome' e 'vagas_total'");
    let imported = 0;
    const errors: string[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const nome = row[iNome]?.trim();
      const vagas = parseInt(row[iVagas] ?? "", 10);
      if (!nome || Number.isNaN(vagas)) continue;
      const { error } = await supabaseAdmin.from("comarcas").upsert(
        { nome, vagas_total: vagas },
        { onConflict: "nome" },
      );
      if (error) errors.push(`Linha ${r + 1}: ${error.message}`);
      else imported++;
    }
    return { imported, errors };
  });

export const adminExportFinalCsv = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toCsv } = await import("@/lib/csv");
    const { data: candidates } = await supabaseAdmin
      .from("candidates")
      .select(
        "ordem_nomeacao, classificacao, nome, cota, status, comarca_id, situacao_original",
      )
      .order("ordem_nomeacao", { ascending: true });
    const { data: comarcas } = await supabaseAdmin
      .from("comarcas")
      .select("id, nome");
    const comarcasById = new Map((comarcas ?? []).map((c) => [c.id, c.nome]));
    const rows: (string | number | null)[][] = [
      [
        "Ordem nomeação",
        "Classificação",
        "Nome",
        "Cota",
        "Status",
        "Comarca escolhida",
        "Situação original",
      ],
    ];
    for (const c of candidates ?? []) {
      rows.push([
        c.ordem_nomeacao,
        c.classificacao,
        c.nome,
        c.cota,
        c.status,
        c.comarca_id ? comarcasById.get(c.comarca_id) ?? "" : "",
        c.situacao_original ?? "",
      ]);
    }
    return toCsv(rows);
  },
);

export const adminListAllCandidates = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("candidates")
      .select(
        "id, ordem_nomeacao, classificacao, nome, cota, status, comarca_id",
      )
      .order("ordem_nomeacao", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);
