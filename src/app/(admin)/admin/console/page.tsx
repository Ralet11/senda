import Link from "next/link";
import { ErrorConsole } from "@/components/admin/error-console";
import { prisma } from "@/lib/prisma";

export default async function AdminConsolePage() {
  const logs = await prisma.errorLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, source: true, message: true, detail: true, projectId: true, createdAt: true },
  });

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-3 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-500">Senda</p>
            <h1 className="text-2xl font-semibold text-zinc-950">Consola de errores</h1>
            <p className="text-sm text-zinc-600">
              Errores de backend en tiempo casi real (asistente, propuestas, project brain). Redactado, no reemplaza los logs de PM2.
            </p>
          </div>
          <Link href="/admin/projects" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            ← Proyectos
          </Link>
        </div>

        <ErrorConsole
          initialLogs={logs.reverse().map((log) => ({ ...log, createdAt: log.createdAt.toISOString() }))}
        />
      </div>
    </main>
  );
}
