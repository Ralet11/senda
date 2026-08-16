import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";
import { prisma } from "@/lib/prisma";
import { answerProjectQuestionAction, reviewProposalAction } from "./actions";

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
  const [questions, proposals] = await Promise.all([
    prisma.projectQuestion.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        askedBy: { select: { name: true } },
        answeredBy: { select: { name: true } },
      },
    }),
    prisma.proposal.findMany({
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
    }),
  ]);

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Senda</p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
              Bandeja de Prisma
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Preguntas sin respuesta y propuestas enviadas por los clientes.
            </p>
          </div>
          <Link href="/admin/console" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            Consola de errores
          </Link>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Preguntas</h2>
            <p className="text-sm text-zinc-600">Consultas que no estaban cubiertas por la documentación del proyecto.</p>
          </div>
          {questions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-8 text-sm text-zinc-500">Todavía no hay preguntas enviadas.</div>
          ) : (
            <div className="grid gap-4">
              {questions.map((question) => {
                const answerAction = answerProjectQuestionAction.bind(null, question.id);
                return (
                  <article key={question.id} className="rounded-lg border border-zinc-200 bg-white p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${question.status === "OPEN" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{question.status === "OPEN" ? "Abierta" : "Respondida"}</span>
                      <span className="text-xs text-zinc-500">{question.project.name} · {question.askedBy.name} · {formatDate(question.createdAt)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-900">{question.question}</p>
                    {question.answer ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Respuesta:</strong> {question.answer}</p> : null}
                    {question.status === "OPEN" ? (
                      <form action={answerAction} className="mt-4 space-y-2">
                        <textarea name="answer" required maxLength={4000} rows={3} className="w-full rounded-lg border border-zinc-300 p-3 text-sm" placeholder="Respuesta confirmada para el cliente..." />
                        <SubmitButton idleLabel="Responder al cliente" pendingLabel="Enviando..." className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-medium text-white disabled:opacity-60" />
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-950">Propuestas</h2>
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
        </section>
      </div>
    </main>
  );
}
