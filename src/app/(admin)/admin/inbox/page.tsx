import { SubmitButton } from "@/components/admin/submit-button";
import { prisma } from "@/lib/prisma";
import { reviewProposalAction } from "./actions";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function statusLabel(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "Enviada";
    case "ACCEPTED":
      return "Aceptada";
    case "DECLINED":
      return "Rechazada";
    default:
      return status;
  }
}

export default async function AdminInboxPage() {
  const proposals = await prisma.proposal.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      reviewedBy: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="border-b border-zinc-200 pb-5">
          <p className="text-sm font-medium text-zinc-500">Senda</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
            Bandeja de propuestas
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Pedidos accionables detectados por el assistant para revisión interna.
          </p>
        </div>

        {proposals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-10 text-sm text-zinc-500">
            Todavía no hay propuestas generadas.
          </div>
        ) : (
          <div className="grid gap-4">
            {proposals.map((proposal) => {
              const acceptAction = reviewProposalAction.bind(null, proposal.id, "ACCEPTED");
              const discardAction = reviewProposalAction.bind(null, proposal.id, "DECLINED");

              return (
                <article
                  key={proposal.id}
                  className="rounded-lg border border-zinc-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-zinc-950">
                          {proposal.title}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            proposal.status === "SUBMITTED"
                              ? "bg-amber-50 text-amber-700"
                              : proposal.status === "ACCEPTED"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {statusLabel(proposal.status)}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-600">
                        Proyecto: {proposal.project.name} ({proposal.project.id})
                      </p>

                      <p className="text-sm leading-6 text-zinc-900">
                        {proposal.description}
                      </p>

                      <p className="text-xs text-zinc-500">
                        Creada el {formatDate(proposal.createdAt)}
                        {proposal.reviewedBy
                          ? ` · revisada por ${proposal.reviewedBy.name}`
                          : ""}
                      </p>
                    </div>

                    {proposal.status === "SUBMITTED" ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={acceptAction}>
                          <SubmitButton
                            idleLabel="Aceptar"
                            pendingLabel="Actualizando..."
                            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </form>
                        <form action={discardAction}>
                          <SubmitButton
                            idleLabel="Descartar"
                            pendingLabel="Actualizando..."
                            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </form>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
