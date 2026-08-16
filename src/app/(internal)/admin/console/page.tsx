import { ErrorConsole } from "@/components/admin/error-console";
import { PageHeader } from "@/components/ui/primitives";
import { prisma } from "@/lib/prisma";

export default async function AdminConsolePage() {
  const logs = await prisma.errorLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, source: true, message: true, detail: true, projectId: true, createdAt: true },
  });

  return (
    <>
      <PageHeader
        eyebrow={<span>Administración</span>}
        title="Consola de errores"
        description="Errores de backend en tiempo casi real (asistente, propuestas, documentación de proyecto). Redactado: no reemplaza los logs de PM2."
      />

      <ErrorConsole
        initialLogs={logs.reverse().map((log) => ({ ...log, createdAt: log.createdAt.toISOString() }))}
      />
    </>
  );
}
