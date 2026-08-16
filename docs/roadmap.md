# Roadmap de implementación

Bloques en orden de dependencia: cada uno necesita que el anterior exista para tener
datos reales con qué trabajar (ej. el dashboard del cliente no tiene sentido hasta
que el admin puede cargar un proyecto de verdad).

## Bloque 0 — Fundaciones ✅
Scaffold de Next.js + Prisma, estructura de carpetas, schema inicial, docs.

## Bloque 1 — Auth & multi-tenancy ✅
- Password hashing (bcryptjs) + sesión persistida en DB (`Session`, token hasheado
  con sha256 en cookie httpOnly), no JWT.
- Layouts de servidor (`(client)/layout.tsx`, `(client)/projects/[projectId]/layout.tsx`,
  `(admin)/layout.tsx`) protegen cada área vía `requireUser` / `requireProjectMember` /
  `requireAdmin` en [auth.ts](../src/lib/auth.ts) — no se usó middleware porque Prisma
  con el driver adapter de `pg` necesita runtime Node, y los layouts son más simples.
- Toda query de proyecto valida membership (`ProjectMember`); si no pertenece o no
  existe, `notFound()` (404) en vez de redirect, para no confirmar que el `projectId`
  existe. Un `ADMIN` puede ver cualquier proyecto.
- Seed script (`npm run db:seed`): admin (`admin@senda.dev` / `admin1234`) + cliente
  (`cliente@ejemplo.com` / `cliente1234`) + proyecto de prueba (`seed-project`).
- Probado manualmente end-to-end: acceso sin sesión → redirect a `/login`; login
  cliente → redirect a su proyecto; cliente no puede ver `/admin` ni otro `projectId`
  (404); admin puede ver cualquier proyecto; logout invalida la sesión.

## Bloque 2 — Panel interno (admin CRUD) ✅
- Crear/editar proyecto, invitar cliente (alta de `User` + `ProjectMember`).
- Cargar fase, % avance, milestones, activity log a mano.
- Necesario antes del bloque 3: sin esto no hay data real que mostrarle al cliente.

## Bloque 3 — Dashboard del cliente (lectura) ✅
- Fase, avance, milestones, "en qué se trabaja ahora", equipo asignado, activity log.
- Todo scopeado por membership del usuario logueado.

## Bloque 4 — Comunicación (chat) ✅
- UI de chat por proyecto sobre el modelo `Message` ya definido.
- Empezar simple (polling), no hace falta WebSockets desde el día 1.
- El email de notificación queda pendiente en el bloque 6.

## Bloque 5 — AI Assistant (parcial)
- Integración con OpenAI Responses API, con historial persistente por proyecto.
- Estado desde PostgreSQL y conocimiento funcional limitado a snapshots de `.senda/knowledge/**/*.md` enviados por la CLI.
- Detección de pedidos accionables y creación de propuestas para la bandeja admin.
- Escalamiento explícito de preguntas sin respuesta hacia la bandeja de Prisma.
- Pendiente: notificaciones y streaming.

## Bloque 6 — Notificaciones
- Email transaccional (Resend o SES): mensaje nuevo, propuesta nueva, cambio de fase.

## Bloque 7 — Deploy (parcial)
- EC2 + PM2 + Nginx + Certbot están desplegados para `senda.prismadevs.com` (ver [deploy-ec2.md](./deploy-ec2.md)).
- CloudFront/ACM/Route53 y health checks formales quedan pendientes.
- Postgres gestionado (RDS) o en el mismo EC2 según presupuesto.
