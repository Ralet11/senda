import { SubmitButton } from "@/components/admin/submit-button";
import { Chip, EmptyState, PageHeader, Panel, SectionHeader } from "@/components/ui/primitives";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/ui";
import { answerProjectQuestionAction, reviewProposalAction } from "./actions";

const PROPOSAL_STATUS: Record<string, { label: string; tone: "warn" | "positive" | "neutral" }> = {
  SUBMITTED: { label: "Enviada", tone: "warn" },
  IN_REVIEW: { label: "En revisión", tone: "warn" },
  ACCEPTED: { label: "Aceptada", tone: "positive" },
  DECLINED: { label: "Rechazada", tone: "neutral" },
};

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
        project: { select: { id: true, name: true } },
        reviewedBy: { select: { name: true } },
      },
    }),
  ]);

  const openQuestions = questions.filter((question) => question.status === "OPEN").length;
  const pendingProposals = proposals.filter((proposal) => proposal.status === "SUBMITTED").length;

  return (
    <>
      <PageHeader
        eyebrow={<span>Administración</span>}
        title="Propuestas y preguntas"
        description="Lo que los clientes enviaron y todavía espera una respuesta del equipo."
      />

      <div className="space-y-9">
        <section>
          <SectionHeader
            title="Preguntas"
            description="Consultas que no estaban cubiertas por la documentación del proyecto."
            actions={openQuestions > 0 ? <Chip tone="warn">{openQuestions} sin responder</Chip> : null}
            className="mb-4"
          />

          {questions.length === 0 ? (
            <EmptyState title="Todavía no hay preguntas enviadas" />
          ) : (
            <Panel padded={false} className="overflow-hidden">
              <ul className="divide-y divide-line">
                {questions.map((question) => {
                  const answerAction = answerProjectQuestionAction.bind(null, question.id);

                  return (
                    <li key={question.id} className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone={question.status === "OPEN" ? "warn" : "positive"} dot>
                          {question.status === "OPEN" ? "Abierta" : "Respondida"}
                        </Chip>
                        <span className="text-[12.5px] text-ink-3">
                          {question.project.name} · {question.askedBy.name} · {formatDate(question.createdAt)}
                        </span>
                      </div>

                      <p className="mt-3 leading-relaxed">{question.question}</p>

                      {question.answer ? (
                        <div className="mt-3 rounded-control border-l-2 border-positive bg-positive-soft px-3.5 py-2.5">
                          <p className="sd-label mb-1">
                            Respuesta{question.answeredBy ? ` · ${question.answeredBy.name}` : ""}
                          </p>
                          <p className="text-[13px] leading-relaxed">{question.answer}</p>
                        </div>
                      ) : null}

                      {question.status === "OPEN" ? (
                        <form action={answerAction} className="mt-4 space-y-2.5">
                          <textarea
                            name="answer"
                            required
                            maxLength={4000}
                            rows={3}
                            placeholder="Respuesta confirmada para el cliente…"
                          />
                          <SubmitButton
                            idleLabel="Responder al cliente"
                            pendingLabel="Enviando…"
                            className="sd-btn sd-btn-primary"
                          />
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </section>

        <section>
          <SectionHeader
            title="Propuestas"
            description="Borradores que los clientes prepararon junto a Senda AI."
            actions={pendingProposals > 0 ? <Chip tone="warn">{pendingProposals} por revisar</Chip> : null}
            className="mb-4"
          />

          {proposals.length === 0 ? (
            <EmptyState title="Todavía no hay propuestas generadas" />
          ) : (
            <Panel padded={false} className="overflow-hidden">
              <ul className="divide-y divide-line">
                {proposals.map((proposal) => {
                  const acceptAction = reviewProposalAction.bind(null, proposal.id, "ACCEPTED");
                  const discardAction = reviewProposalAction.bind(null, proposal.id, "DECLINED");
                  const status = PROPOSAL_STATUS[proposal.status] ?? { label: proposal.status, tone: "neutral" as const };

                  return (
                    <li key={proposal.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-semibold">{proposal.title}</h3>
                          <Chip tone={status.tone}>{status.label}</Chip>
                        </div>

                        <p className="mt-2 leading-relaxed text-ink-2">{proposal.description}</p>

                        <p className="mt-2 text-[12.5px] text-ink-3">
                          {proposal.project.name} · creada el {formatDate(proposal.createdAt)}
                          {proposal.reviewedBy ? ` · revisada por ${proposal.reviewedBy.name}` : ""}
                        </p>
                      </div>

                      {proposal.status === "SUBMITTED" ? (
                        <div className="flex shrink-0 gap-2">
                          <form action={acceptAction}>
                            <SubmitButton
                              idleLabel="Aceptar"
                              pendingLabel="Actualizando…"
                              className="sd-btn sd-btn-primary"
                            />
                          </form>
                          <form action={discardAction}>
                            <SubmitButton
                              idleLabel="Descartar"
                              pendingLabel="Actualizando…"
                              className="sd-btn sd-btn-outline"
                            />
                          </form>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </section>
      </div>
    </>
  );
}
