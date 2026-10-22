# Senda

**Un espacio compartido entre un estudio de desarrollo y sus clientes:** estado del proyecto, tareas, hitos, conversaciones y conocimiento funcional en un mismo portal.

Aplicación full stack construida con **Next.js 16, React 19, TypeScript, Prisma 7 y PostgreSQL**. Incluye una CLI de sincronización documental y un asistente con contexto por proyecto.

> Este repositorio permite revisar la implementación y levantar una demo local. La existencia de una funcionalidad en código no equivale a aceptación de cliente, auditoría de seguridad ni disponibilidad de una demo pública. Los datos del seed son ficticios.

## Qué se puede explorar

- **Acceso por invitación del equipo:** no hay auto-registro público; `/register` redirige al login.
- **Portal cliente:** seguimiento de proyectos, hitos, novedades y conversaciones.
- **Espacio interno:** gestión de tareas, responsables, documentación y borradores de novedades.
- **Acceso por rol y proyecto:** sesiones persistidas mediante hashes y controles de membresía en servidor.
- **Asistente contextual:** consulta de documentación del proyecto y derivación de preguntas sin respuesta al equipo.
- **Sincronización de agentes:** API y CLI con tokens limitados a un proyecto e idempotencia. Los agentes generan borradores, no publican novedades automáticamente al cliente.
- **Ideación pública:** endpoint para un primer mapa de producto, con configuración de orígenes permitidos.

## Recorrido técnico sugerido

| Área | Dónde mirar | Decisión relevante |
| --- | --- | --- |
| Acceso | [`src/lib/auth.ts`](src/lib/auth.ts) | Autorización en servidor, sesiones con hash y caducidad |
| Sincronización | [`src/lib/project-agent-sync.ts`](src/lib/project-agent-sync.ts) | Alcance por proyecto, validación y transacciones |
| Conocimiento | [`src/lib/project-knowledge.ts`](src/lib/project-knowledge.ts) | Snapshot documental, sin clonar repositorios en el portal |
| Datos | [`prisma/schema.prisma`](prisma/schema.prisma) | Relaciones entre usuarios, proyectos, tareas y conversaciones |
| CLI | [`tools/senda-cli`](tools/senda-cli) | Inicialización, validación y sincronización de `.senda/knowledge/` |

## Ejecutar una demo local

Requisitos: **Node.js 24** (ver `.nvmrc`), npm y una instancia **local y descartable de PostgreSQL**. El checkout no incluye una base de datos ni credenciales de servicios.

```bash
git clone https://github.com/Ralet11/senda.git
cd senda
npm ci
cp .env.example .env
```

Crear una base local vacía y ajustar `DATABASE_URL` en `.env`. Después:

```bash
npm run db:generate
npm run db:migrate:deploy
SENDA_ALLOW_DEMO_SEED=true npm run db:seed
npm run dev
```

En PowerShell, el opt-in se expresa como `$env:SENDA_ALLOW_DEMO_SEED="true"` antes del seed. Volver a quitarlo después. Abrir [localhost:3000](http://localhost:3000).

El seed solo acepta PostgreSQL en loopback (`localhost`, `127.0.0.1` o `::1`), exige opt-in y se niega a ejecutarse con `NODE_ENV=production`. Aun así, revisar el destino antes de migrar: **las migraciones escriben en la base configurada**. Nunca usar datos o credenciales de clientes para esta demo.

Cuentas ficticias creadas por el seed, exclusivamente para uso local:

| Perfil | Correo | Contraseña demo |
| --- | --- | --- |
| Admin | `admin@senda.dev` | `admin1234` |
| Cliente | `cliente@ejemplo.com` | `cliente1234` |

`OPENAI_API_KEY` es opcional para explorar la interfaz sin IA. El asistente y la ideación requieren una clave propia y acceso al modelo configurado; realizar llamadas puede generar cargos. No se incluyen claves ni se habilitan llamadas pagas en los tests.

## Validación

```bash
npm run db:generate
npm run lint
npm test
npm run test:cli
npm run typecheck
npm run build
```

- `npm test`: pruebas de barreras del seed, rate limiting, contraseñas y adjuntos; no utiliza una base de datos.
- `npm run test:cli`: suite existente de la CLI.
- `npm run typecheck` y `npm run build`: verificación estática y compilación web; no demuestran que todos los flujos integrados funcionen.
- El build descarga las fuentes de Google utilizadas por `next/font`; necesita acceso de red a ese proveedor.
- `npm run test:http`: smoke tests HTTP reales de rutas sin sesión, validación de login y logout idempotente. Requiere un build previo; no usa PostgreSQL.
- `npm run test:browser`: cinco pruebas Playwright de acceso sin sesión y estados de la UI. Ejecutar primero `npx playwright install chromium` y `npm run build`. Los errores de autenticación se interceptan expresamente; estas pruebas **no** validan login contra PostgreSQL ni un portal autenticado.
- [Checklist de demostración](docs/portfolio-review.md): pasos manuales y límites de cobertura.

## Estructura

```text
src/app/             Rutas, layouts, acciones y endpoints Next.js
src/components/      Componentes de interfaz
src/lib/             Lógica de aplicación y acceso a datos
prisma/              Esquema, migraciones y seed local
prisma/seed-safety.mjs Barreras para evitar usar la demo en producción
tests/               Pruebas del portal sin servicios externos
tools/senda-cli/     CLI y sus pruebas
docs/                Contratos y guías técnicas
```

## Documentación y límites

- [CLI y API de agentes](docs/senda-cli.md)
- [Integración de ideación](docs/public-ideation.md)
- [Guía operativa de despliegue](docs/deploy-ec2.md), separada del arranque local.
- El limitador actual vive en memoria de un proceso. Antes de escalar a múltiples instancias se necesita un mecanismo compartido.
- Los adjuntos se guardan en disco: un despliegue necesita almacenamiento persistente y política de backup.
- No se incluyen capturas de clientes ni se publica una demo con datos reales. Capturas o video deben generarse únicamente con datos ficticios y sin tokens visibles.
