import { NextResponse } from "next/server";

// Retirado: este endpoint usaba una sola credencial para todos los proyectos y
// permitía publicar al cliente. Migrar a /api/external/v1/sync y Senda CLI.
export async function POST() {
  return NextResponse.json({
    error: "ENDPOINT_RETIRED",
    message: "Usá /api/external/v1/sync con una clave de proyecto de Senda CLI.",
  }, { status: 410 });
}
