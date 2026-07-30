import "server-only";
import { prisma } from "@/lib/prisma";
import { searchProjectRepo } from "@/lib/project-repo";

type AssistantHistoryItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sourceFiles?: Array<{
    path: string;
    excerpt: string;
  }>;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function formatDate(value: Date | null) {
  if (!value) return "sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function summarizeMilestones(
  milestones: Array<{ title: string; doneAt: Date | null; dueDate: Date | null }>,
) {
  if (milestones.length === 0) {
    return "No hay hitos cargados todavia.";
  }

  const pending = milestones.filter((milestone) => !milestone.doneAt);
  const completed = milestones.filter((milestone) => milestone.doneAt);
  const nextMilestone = pending[0];

  return [
    `Hitos cerrados: ${completed.length}.`,
    `Hitos pendientes: ${pending.length}.`,
    nextMilestone
      ? `Proximo hito: ${nextMilestone.title} (${formatDate(nextMilestone.dueDate)}).`
      : "No quedan hitos pendientes.",
  ].join(" ");
}

function summarizeTeam(
  members: Array<{
    role: string;
    user: { name: string; globalRole: string };
  }>,
) {
  const team = members
    .filter((member) => member.role === "TEAM")
    .map((member) => member.user.name);
  const clients = members
    .filter((member) => member.user.globalRole === "CLIENT")
    .map((member) => member.user.name);

  return [
    team.length > 0 ? `Equipo Senda: ${team.join(", ")}.` : "Sin equipo Senda asignado.",
    clients.length > 0
      ? `Contactos cliente: ${clients.join(", ")}.`
      : "Sin contactos cliente cargados.",
  ].join(" ");
}

function summarizeActivity(activityLogs: Array<{ message: string; createdAt: Date }>) {
  if (activityLogs.length === 0) {
    return "Sin actividad reciente cargada.";
  }

  const latest = activityLogs.slice(0, 4);
  return `Actividad reciente: ${latest
    .map((entry) => `${entry.message} (${formatDate(entry.createdAt)})`)
    .join(" | ")}.`;
}

function detectActionableRequest(message: string) {
  const normalized = message.toLowerCase();
  const actionablePatterns = [
    /podemos agregar/,
    /quiero agregar/,
    /sumar/,
    /integrar/,
    /necesitamos/,
    /propuesta/,
    /presupuesto/,
    /cotiz/,
    /seria bueno/,
    /sería bueno/,
    /hagamos/,
    /me gustaria/,
    /me gustaría/,
  ];

  return actionablePatterns.some((pattern) => pattern.test(normalized));
}

function isCodeQuestion(message: string) {
  const normalized = message.toLowerCase();
  const patterns = [
    "repo",
    "codigo",
    "código",
    "markup",
    "markdown",
    "html",
    "tsx",
    "jsx",
    "css",
    "componente",
    "render",
    "implement",
    "archivo",
    "frontend",
    "backend",
    "api",
  ];

  return patterns.some((pattern) => normalized.includes(pattern));
}

function shouldSearchRepoContext(input: {
  message: string;
  projectName: string;
}) {
  const normalized = input.message.toLowerCase();
  const normalizedProjectName = input.projectName.toLowerCase();

  if (isCodeQuestion(input.message)) {
    return true;
  }

  const productQuestionPatterns = [
    "que es",
    "qué es",
    "de que se trata",
    "de qué se trata",
    "que hace",
    "qué hace",
    "para que sirve",
    "para qué sirve",
    "como funciona",
    "cómo funciona",
    "stack",
    "arquitectura",
    "modulos",
    "módulos",
  ];

  if (productQuestionPatterns.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  if (!normalizedProjectName) {
    return false;
  }

  return normalized.includes(normalizedProjectName);
}

function buildProposalTitle(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  const sentence = trimmed.split(/[.!?]/)[0] || trimmed;
  return sentence.length > 72 ? `${sentence.slice(0, 69)}...` : sentence;
}

function buildProjectContextBlock(project: {
  name: string;
  phase: string;
  progress: number;
  summary: string | null;
  milestones: Array<{ title: string; doneAt: Date | null; dueDate: Date | null }>;
  members: Array<{ role: string; user: { name: string; globalRole: string } }>;
  activityLogs: Array<{ message: string; createdAt: Date }>;
}) {
  return [
    `Proyecto: ${project.name}.`,
    `Fase actual: ${project.phase}.`,
    `Avance declarado: ${project.progress}%.`,
    `Resumen del proyecto: ${project.summary || "Sin resumen cargado."}`,
    summarizeMilestones(project.milestones),
    summarizeTeam(project.members),
    summarizeActivity(project.activityLogs),
  ].join("\n");
}

function buildRepoContextBlock(input: {
  repoContext:
    | {
        repoAvailable: boolean;
        reason: string | null;
        results: Array<{ path: string; excerpt: string }>;
      }
    | null;
  repoLocalPath: string | null;
}) {
  const { repoContext, repoLocalPath } = input;

  if (!repoContext) {
    return "No se consulto el repo para este mensaje.";
  }

  if (!repoContext.repoAvailable) {
    return repoContext.reason || "No hay repo local enlazado disponible.";
  }

  if (repoContext.results.length === 0) {
    return `Se consulto el repo ${repoLocalPath || "local"}, pero no aparecieron archivos claramente relevantes.`;
  }

  return [
    `Repo consultado: ${repoLocalPath || "local"}.`,
    ...repoContext.results.map(
      (result, index) =>
        `${index + 1}. ${result.path}\n${result.excerpt.replace(/\s+/g, " ").trim()}`,
    ),
  ].join("\n");
}

function buildSystemPrompt(input: {
  projectName: string;
  projectContext: string;
  repoContextBlock: string;
  createdProposal: boolean;
}) {
  const { projectName, projectContext, repoContextBlock, createdProposal } = input;

  return [
    "Sos el assistant conversacional de Senda para clientes de un estudio de desarrollo.",
    "Tenes que responder en espanol rioplatense, tono claro, calmo y profesional.",
    "Comportate como un chat real: respuestas naturales, seguimiento conversacional y sin sonar a sistema rigido.",
    "No vuelques un resumen completo del proyecto salvo que el usuario lo pida o haga falta para responder.",
    "Si el mensaje es corto o informal, respondi de forma natural y ayudalo a avanzar.",
    "Si falta contexto para una respuesta precisa, pedi una aclaracion breve.",
    "Si te preguntan por estado, hitos, equipo, riesgos o proximos pasos, usa el contexto del proyecto.",
    "Si te preguntan algo tecnico del producto o implementacion, apoyate en el contexto del repo provisto.",
    "No inventes datos. Si algo no esta en el contexto, decilo con claridad.",
    "Por defecto responde corto, salvo que el usuario pida detalle.",
    createdProposal
      ? "Ademas, ya se genero internamente una propuesta accionable a partir de este pedido. Podes mencionarlo de forma breve si aporta valor."
      : "Solo menciona propuestas internas si el usuario pregunta por eso o si ayuda mucho a aclarar el siguiente paso.",
    `Proyecto activo: ${projectName}.`,
    "",
    "Contexto del proyecto:",
    projectContext,
    "",
    "Contexto de repo disponible para esta consulta:",
    repoContextBlock,
  ].join("\n");
}

async function callOpenAIResponse(messages: OpenAIMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }

  const model = process.env.OPENAI_MODEL || "gpt-5";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: messages,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | {
        output?: Array<{
          type?: string;
          content?: Array<{
            type?: string;
            text?: string;
          }>;
        }>;
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(data?.error?.message || "OPENAI_RESPONSE_ERROR");
  }

  const text = data?.output
    ?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  return text;
}

async function getRecentConversation(projectId: string) {
  const chunks = await prisma.projectContextChunk.findMany({
    where: {
      projectId,
      source: {
        in: ["assistant_user", "assistant_reply"],
      },
    },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  return chunks.map((chunk) => ({
    role: chunk.source === "assistant_user" ? ("user" as const) : ("assistant" as const),
    content: chunk.content,
  }));
}

export async function getAssistantHistory(projectId: string): Promise<AssistantHistoryItem[]> {
  const chunks = await prisma.projectContextChunk.findMany({
    where: {
      projectId,
      source: {
        in: ["assistant_user", "assistant_reply"],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return chunks.map((chunk) => ({
    id: chunk.id,
    role: chunk.source === "assistant_user" ? "user" : "assistant",
    content: chunk.content,
    createdAt: chunk.createdAt.toISOString(),
    sourceFiles: [],
  }));
}

export async function createAssistantReply(projectId: string, message: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      milestones: {
        orderBy: [{ doneAt: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      },
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              name: true,
              globalRole: true,
            },
          },
        },
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const title = buildProposalTitle(message);
  const shouldCreateProposal = detectActionableRequest(message);
  const repoContext = shouldSearchRepoContext({
    message,
    projectName: project.name,
  })
    ? await searchProjectRepo({
        repoLocalPath: project.repoLocalPath,
        question: message,
      })
    : null;

  const existingProposal = shouldCreateProposal
    ? await prisma.proposal.findFirst({
        where: {
          projectId,
          status: "PENDING",
          title,
        },
        select: { id: true },
      })
    : null;

  const createdProposal = shouldCreateProposal && !existingProposal;
  const history = await getRecentConversation(projectId);

  const messages: OpenAIMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        projectName: project.name,
        projectContext: buildProjectContextBlock(project),
        repoContextBlock: buildRepoContextBlock({
          repoContext,
          repoLocalPath: project.repoLocalPath,
        }),
        createdProposal,
      }),
    },
    ...history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    {
      role: "user",
      content: message,
    },
  ];

  const reply = await callOpenAIResponse(messages);

  const result = await prisma.$transaction(async (tx) => {
    const userChunk = await tx.projectContextChunk.create({
      data: {
        projectId,
        source: "assistant_user",
        content: message,
      },
    });

    const replyChunk = await tx.projectContextChunk.create({
      data: {
        projectId,
        source: "assistant_reply",
        content: reply,
      },
    });

    const proposal = createdProposal
      ? await tx.proposal.create({
          data: {
            projectId,
            title,
            description: message,
          },
        })
      : null;

    return { userChunk, replyChunk, proposal };
  });

  return {
    reply: {
      id: result.replyChunk.id,
      role: "assistant" as const,
      content: result.replyChunk.content,
      createdAt: result.replyChunk.createdAt.toISOString(),
      sourceFiles: repoContext?.repoAvailable ? repoContext.results : [],
    },
    userMessage: {
      id: result.userChunk.id,
      role: "user" as const,
      content: result.userChunk.content,
      createdAt: result.userChunk.createdAt.toISOString(),
      sourceFiles: [],
    },
    proposal: result.proposal
      ? {
          id: result.proposal.id,
          title: result.proposal.title,
          status: result.proposal.status,
        }
      : null,
  };
}
