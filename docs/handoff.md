# Handoff — Senda

Resumen para que otro agente/IA pueda continuar este proyecto sin perder contexto.
Leer también los otros docs, cada uno tiene el detalle de lo que su nombre indica:

- [features.md](./features.md) — qué incluye el producto (MVP vs fase 2).
- [decisions.md](./decisions.md) — por qué se eligió cada pieza del stack.
- [roadmap.md](./roadmap.md) — bloques de implementación, en orden, con lo hecho marcado ✅.
- [conventions.md](./conventions.md) — reglas de código del repo.

## Qué es esto
Panel web para los clientes de Senda (estudio de desarrollo de software con IA,
dueño: Ramiro). Cada cliente ve un dashboard de su proyecto (fase, avance, en qué se
está trabajando, quién del equipo), un chat con el equipo, y un AI assistant con
contexto del proyecto para discutir ideas — las ideas accionables se convierten en
"propuestas" que caen en una bandeja interna para Ramiro. Ver detalle completo en
[features.md](./features.md).

## Stack
- **Next.js 16** (App Router, TypeScript, Tailwind) — un solo proyecto para
  frontend + backend (API routes). No Express: se necesitan pantallas reales, no
  solo una API.
- **PostgreSQL 16** local (instalado como servicio de Windows, no Docker) +
  **Prisma 7** como ORM (no Sequelize, por tipado end-to-end y mejor soporte en el
  ecosistema Next.js/IA).
- Deploy actual: EC2 + PM2 + Nginx + Certbot en `senda.prismadevs.com`. CloudFront y
  health checks formales siguen pendientes. Ver [deploy-ec2.md](./deploy-ec2.md).

## Estado actual
Los bloques 0 a 4 están implementados. El bloque 5 tiene un assistant funcional con
OpenAI, historial persistente y conocimiento curado desde `.senda/knowledge/**/*.md`. Las
preguntas sin respuesta pueden enviarse explícitamente a Prisma. El deploy actual
está en el commit que figura en `main`.

Implementado y probado end-to-end (con curl, manualmente):
- Modelos Prisma: `User`, `Project`, `ProjectMember`, `Milestone`, `ActivityLog`,
  `Message`, `Proposal`, `ProjectContextChunk` (para RAG futuro), `Session`.
- Auth propia (no NextAuth): password hashing con `bcryptjs`, sesión persistida en
  la tabla `Session` (el cookie solo lleva un token random; la DB guarda su sha256 —
  así se puede revocar con un DELETE, sin esperar expiración de JWT).
- Autorización vía **layouts de servidor** (no middleware — el driver de Postgres
  necesita runtime Node, Next middleware corre en Edge por default):
  - `src/app/(client)/layout.tsx` → requiere sesión.
  - `src/app/(client)/projects/[projectId]/layout.tsx` → requiere membership en
    ese proyecto (admin puede ver cualquiera).
  - `src/app/(admin)/layout.tsx` → requiere `globalRole === "ADMIN"`.
  - Acceso no autorizado a un proyecto ajeno o a `/admin` → `notFound()` (404), no
    redirect, para no confirmar que el recurso existe.
- Helpers en [src/lib/auth.ts](../src/lib/auth.ts): `requireUser`, `requireAdmin`,
  `requireProjectMember`, `getCurrentUser`, `createSession`, `destroyCurrentSession`.
- Rutas `POST /api/auth/login` y `POST /api/auth/logout`, página `/login` funcional.
- Seed script (`npm run db:seed`, en [prisma/seed.ts](../prisma/seed.ts)) crea:
  - admin: `admin@senda.dev` / `admin1234`
  - cliente: `cliente@ejemplo.com` / `cliente1234`
  - proyecto: `seed-project` (con ambos como members)

## Cómo correr el proyecto
1. Postgres local debe estar corriendo (servicio Windows `postgresql-x64-16`,
   user/pass `postgres`/`admin`, DB `senda` — ya creada). `.env` ya tiene el
   `DATABASE_URL` apuntando ahí.
2. `npm install` si hace falta.
3. `npx prisma migrate dev` si el schema cambió.
4. `npm run db:seed` para tener usuarios de prueba.
5. `npm run dev` → http://localhost:3000/login

## Gotchas de este setup específico
- **Prisma 7 requiere un driver adapter**: el constructor de `PrismaClient` ya no
  acepta connection string directa, hay que pasarle `@prisma/adapter-pg`. Ver
  [src/lib/prisma.ts](../src/lib/prisma.ts). Si se regenera el cliente
  (`prisma generate`) después de tocar el schema, hacerlo siempre — el cliente
  generado en `src/generated/prisma` no se actualiza solo.
- El cliente generado vive en `src/generated/prisma`, importado como
  `@/generated/prisma/client` (no `@/generated/prisma` a secas — esa ruta no
  tiene export).
- `.gitignore` tiene `.env*` pero con excepción `!.env.example` — si se agregan
  más archivos de env, revisar que no se ignoren por accidente.
- El servicio de Windows de Postgres puede quedar en estado "Stopped" en el SCM
  aunque el proceso esté vivo, si el arranque tarda por recovery (pasó una vez acá).
  Si algo no conecta, chequear con `Test-NetConnection -ComputerName localhost -Port 5432`
  antes de asumir que Postgres está caído.

## Próximos pasos
- Completar notificaciones, recuperación de contraseña, registro real y adjuntos.
- Agregar evaluaciones automáticas sobre los documentos `.senda` de cada proyecto.
- Añadir pruebas automatizadas y health checks de despliegue.
