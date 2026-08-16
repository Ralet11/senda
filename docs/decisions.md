# Decisiones de arquitectura

## Framework: Next.js (no Express)
Necesitamos pantallas reales (login, dashboard, chat) además de backend. Next.js da
frontend + backend (API routes/server actions) en un solo proyecto y un solo deploy.
Express solo resuelve la parte de backend; obligaría a mantener un frontend aparte.

## Base de datos: PostgreSQL
Además de ser confiable para datos relacionales (usuarios, proyectos, membresías),
permite conservar conversaciones, preguntas y respuestas del equipo sin sumar otro
servicio. El conocimiento funcional se mantiene versionado como Markdown en cada repo.

## ORM: Prisma (no Sequelize)
Tipado end-to-end con TypeScript generado desde el schema, mejor integración con el
ecosistema Next.js, y más contexto/documentación disponible para desarrollo asistido
por IA que Sequelize.

## Deploy (referencia, pendiente de implementar)
Mismo patrón que se usa hoy con Express en AWS, adaptado:
- Next.js corre como proceso Node en EC2 (`next start` vía PM2 o systemd) — no se
  puede servir 100% estático desde S3 porque hay SSR, API routes y streaming del AI
  assistant.
- Nginx como reverse proxy (igual que con Express), CloudFront + ACM + Route53
  delante para TLS y cacheo de assets estáticos (`_next/static/*`).
- Logs en tiempo real: PM2 (`pm2 logs`, `pm2 monit`) para ver localmente por SSH, o
  CloudWatch Agent + `aws logs tail --follow` para verlos sin entrar por SSH.

## Sesiones: DB-backed, no JWT
`Session` es una tabla propia (no NextAuth). El cookie solo guarda un token random;
la DB guarda el sha256 de ese token. Ventaja sobre JWT: revocar una sesión (logout,
"cerrar todas las sesiones") es un `DELETE`, no hay que esperar a que expire un token
firmado. El costo es una query por request para resolver el usuario — aceptable para
el volumen de clientes que maneja Senda.

## Prisma 7 requiere un driver adapter
Desde Prisma 7, el constructor de `PrismaClient` ya no acepta una connection string
directa: exige un driver adapter (`@prisma/adapter-pg` para Postgres) o una URL de
Prisma Accelerate. Ver [prisma.ts](../src/lib/prisma.ts).

## Autorización: layouts de servidor, no middleware
Next.js middleware corre en Edge runtime por default, y el driver adapter de Postgres
(`pg`) necesita Node.js. En vez de forzar runtime Node en el middleware, la
autorización vive en layouts de servidor por route group (ver [roadmap.md](./roadmap.md)
Bloque 1) — más simple y con acceso directo a Prisma.

## Estructura de carpetas
- `src/app/(auth)` — login/registro, sin sidebar de proyecto.
- `src/app/(client)` — portal del cliente, todo scopeado a `projects/[projectId]`.
- `src/app/(admin)` — panel interno de Ramiro/equipo (bandeja de propuestas, CRUD de proyectos).
- `src/app/api` — route handlers, agrupados por dominio (auth, projects, chat, assistant).
- `src/lib` — clientes/servicios compartidos (Prisma, auth, lógica del AI assistant).
- `src/generated/prisma` — cliente de Prisma generado (no editar a mano).
