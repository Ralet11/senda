import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@senda.dev" },
    update: {},
    create: {
      email: "admin@senda.dev",
      name: "Ramiro (admin)",
      passwordHash: await bcrypt.hash("admin1234", 12),
      globalRole: "ADMIN",
    },
  });

  const client = await prisma.user.upsert({
    where: { email: "cliente@ejemplo.com" },
    update: {},
    create: {
      email: "cliente@ejemplo.com",
      name: "Cliente de prueba",
      passwordHash: await bcrypt.hash("cliente1234", 12),
      globalRole: "CLIENT",
    },
  });

  const designer = await prisma.user.upsert({
    where: { email: "sofia@senda.dev" },
    update: {},
    create: {
      email: "sofia@senda.dev",
      name: "Sofia UX",
      passwordHash: await bcrypt.hash("sofia1234", 12),
      globalRole: "ADMIN",
    },
  });

  const developer = await prisma.user.upsert({
    where: { email: "tomas@senda.dev" },
    update: {},
    create: {
      email: "tomas@senda.dev",
      name: "Tomas Dev",
      passwordHash: await bcrypt.hash("tomas1234", 12),
      globalRole: "ADMIN",
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "seed-project" },
    update: {
      name: "Portal Senda Demo",
      phase: "DEVELOPMENT",
      progress: 68,
      summary:
        "Portal cliente para seguimiento del proyecto, chat con el equipo y assistant con contexto del producto.",
      repoProvider: "LOCAL",
      repoLocalPath: ".",
      repoDefaultBranch: "main",
    },
    create: {
      id: "seed-project",
      name: "Portal Senda Demo",
      phase: "DEVELOPMENT",
      progress: 68,
      summary:
        "Portal cliente para seguimiento del proyecto, chat con el equipo y assistant con contexto del producto.",
      repoProvider: "LOCAL",
      repoLocalPath: ".",
      repoDefaultBranch: "main",
    },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: client.id } },
    update: {},
    create: { projectId: project.id, userId: client.id, role: "OWNER" },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: {},
    create: { projectId: project.id, userId: admin.id, role: "TEAM" },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: designer.id } },
    update: {},
    create: { projectId: project.id, userId: designer.id, role: "TEAM" },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: developer.id } },
    update: {},
    create: { projectId: project.id, userId: developer.id, role: "TEAM" },
  });

  const milestoneData = [
    {
      title: "Discovery y definición funcional",
      dueDate: new Date("2026-06-24T00:00:00.000Z"),
      doneAt: new Date("2026-06-22T00:00:00.000Z"),
    },
    {
      title: "Dashboard cliente navegable",
      dueDate: new Date("2026-07-10T00:00:00.000Z"),
      doneAt: new Date("2026-07-12T00:00:00.000Z"),
    },
    {
      title: "Panel admin para carga manual",
      dueDate: new Date("2026-07-24T00:00:00.000Z"),
      doneAt: null,
    },
    {
      title: "Chat por proyecto",
      dueDate: new Date("2026-08-05T00:00:00.000Z"),
      doneAt: null,
    },
  ];

  for (const milestone of milestoneData) {
    await prisma.milestone.upsert({
      where: { id: `${project.id}-${milestone.title}` },
      update: {
        dueDate: milestone.dueDate,
        doneAt: milestone.doneAt,
      },
      create: {
        id: `${project.id}-${milestone.title}`,
        projectId: project.id,
        title: milestone.title,
        dueDate: milestone.dueDate,
        doneAt: milestone.doneAt,
      },
    });
  }

  const activityMessages = [
    "Se cerró la estructura base de autenticación y permisos por proyecto.",
    "Diseño validó la jerarquía del dashboard y los estados principales del portal.",
    "Se empezó la carga manual del panel admin para evitar depender de scripts sobre DB.",
    "Se preparó el bloque 3 para mostrar hitos, equipo y actividad reciente al cliente.",
  ];

  for (const [index, message] of activityMessages.entries()) {
    await prisma.activityLog.upsert({
      where: { id: `${project.id}-activity-${index + 1}` },
      update: { message },
      create: {
        id: `${project.id}-activity-${index + 1}`,
        projectId: project.id,
        message,
      },
    });
  }

  const seedMessages = [
    {
      id: `${project.id}-message-1`,
      authorId: client.id,
      body: "Hola equipo, ¿quedó confirmado que esta semana vemos el dashboard del cliente con hitos y actividad?",
      isFromAssistant: false,
    },
    {
      id: `${project.id}-message-2`,
      authorId: admin.id,
      body: "Sí. Hoy cerramos la lectura del dashboard y dejamos el panel admin listo para seguir cargando contenido real.",
      isFromAssistant: false,
    },
    {
      id: `${project.id}-message-3`,
      authorId: designer.id,
      body: "Del lado de UX ya validamos la estructura para que la timeline y el equipo asignado se entiendan rápido.",
      isFromAssistant: false,
    },
    {
      id: `${project.id}-message-4`,
      authorId: null,
      body: "Puedo ayudarte a convertir decisiones de producto en propuestas accionables para el equipo cuando habilitemos el bloque de assistant.",
      isFromAssistant: true,
    },
  ];

  for (const [index, message] of seedMessages.entries()) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: {
        body: message.body,
        authorId: message.authorId,
        isFromAssistant: message.isFromAssistant,
      },
      create: {
        id: message.id,
        projectId: project.id,
        authorId: message.authorId,
        body: message.body,
        isFromAssistant: message.isFromAssistant,
        createdAt: new Date(Date.UTC(2026, 6, 20 + index, 15 + index, 0, 0)),
      },
    });
  }

  const assistantChunks = [
    {
      id: `${project.id}-assistant-user-1`,
      source: "assistant_user",
      content: "¿En qué estado está el proyecto hoy?",
      createdAt: new Date(Date.UTC(2026, 6, 24, 14, 0, 0)),
    },
    {
      id: `${project.id}-assistant-reply-1`,
      source: "assistant_reply",
      content:
        "Proyecto Portal Senda Demo: fase DEVELOPMENT, avance 68%. Hay 2 milestones cerrados y 2 pendientes. El próximo hito es \"Panel admin para carga manual\" con fecha 24 jul 2026.",
      createdAt: new Date(Date.UTC(2026, 6, 24, 14, 1, 0)),
    },
  ];

  for (const chunk of assistantChunks) {
    await prisma.projectContextChunk.upsert({
      where: { id: chunk.id },
      update: {
        source: chunk.source,
        content: chunk.content,
      },
      create: {
        id: chunk.id,
        projectId: project.id,
        source: chunk.source,
        content: chunk.content,
        createdAt: chunk.createdAt,
      },
    });
  }

  await prisma.proposal.upsert({
    where: { id: `${project.id}-proposal-1` },
    update: {
      title: "Integrar pasarela de pagos en el portal cliente",
      description:
        "El cliente quiere evaluar sumar pagos dentro del portal para la fase siguiente.",
      status: "SUBMITTED",
      reviewedById: null,
    },
    create: {
      id: `${project.id}-proposal-1`,
      projectId: project.id,
      title: "Integrar pasarela de pagos en el portal cliente",
      description:
        "El cliente quiere evaluar sumar pagos dentro del portal para la fase siguiente.",
      status: "SUBMITTED",
    },
  });

  await prisma.projectUpdate.upsert({
    where: { id: `${project.id}-update-1` },
    update: {
      title: "Dashboard validado y panel admin listo para carga manual",
      summary:
        "Cerramos la lectura del dashboard cliente y dejamos preparado el panel admin para seguir cargando contenido real sin depender de scripts externos.",
      nextSteps:
        "Cargar contenido real en el panel admin\nValidar siguiente iteracion del dashboard con datos reales",
      risks:
        "Falta priorizacion final del modulo de pagos para ordenar la siguiente fase",
      suggestedPhase: "DEVELOPMENT",
      suggestedProgress: 72,
      status: "PUBLISHED",
      source: "MANUAL",
      kind: "CLIENT",
      publishedAt: new Date("2026-07-29T15:30:00.000Z"),
    },
    create: {
      id: `${project.id}-update-1`,
      projectId: project.id,
      title: "Dashboard validado y panel admin listo para carga manual",
      summary:
        "Cerramos la lectura del dashboard cliente y dejamos preparado el panel admin para seguir cargando contenido real sin depender de scripts externos.",
      nextSteps:
        "Cargar contenido real en el panel admin\nValidar siguiente iteracion del dashboard con datos reales",
      risks:
        "Falta priorizacion final del modulo de pagos para ordenar la siguiente fase",
      suggestedPhase: "DEVELOPMENT",
      suggestedProgress: 72,
      status: "PUBLISHED",
      source: "MANUAL",
      kind: "CLIENT",
      publishedAt: new Date("2026-07-29T15:30:00.000Z"),
      createdByUserId: admin.id,
    },
  });

  console.log("Seed OK:");
  console.log("  admin:   admin@senda.dev / admin1234");
  console.log("  cliente: cliente@ejemplo.com / cliente1234");
  console.log(`  proyecto: ${project.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
