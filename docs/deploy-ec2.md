# Operación de Senda en EC2

Referencia genérica para una instalación administrada de Next.js, PostgreSQL, PM2 y Nginx. No contiene direcciones ni inventario del host real. Las rutas, dominios, usuarios y credenciales concretas se mantienen fuera del repositorio.

**Esta guía no autoriza ni ejecuta un despliegue.** Para explorar el proyecto usar el [arranque local](../README.md). No utilizar el seed demo en producción.

## Requisitos de una instalación existente

- Node.js 24 y dependencias compatibles con el lockfile.
- Checkout exclusivo para Senda, base y usuario PostgreSQL propios.
- `.env.production` privado, basado en `.env.production.example`.
- Proceso PM2 `senda` y puerto interno configurado en `ecosystem.config.cjs`.
- Reverse proxy y TLS configurados por el responsable de infraestructura.
- Persistencia y backups para base y adjuntos; recursos suficientes para compilar.

La instalación inicial de base de datos, reverse proxy, TLS o servicios debe planificarse aparte. No modificar otros servicios del servidor como parte de una actualización de Senda.

## Verificación previa, en un checkout de desarrollo

```bash
npm ci
npm run db:generate
npm run check
```

Revisar el diff, aprobar el release y comprobar que no contiene secretos. Un build correcto no sustituye los tests funcionales, la validación de migraciones ni la aprobación del despliegue.

## Actualización de una instalación existente

El único método permitido por `AGENTS.md` es `scripts/deploy.sh`, ejecutado **en el host autorizado**, dentro del checkout de Senda. No ejecutar manualmente allí instalaciones, builds, migraciones o reinicios.

Antes de invocarlo, revisar el script de la versión a publicar y verificar:

- Checkout limpio y rama/release correcto.
- Existencia de `.env.production`, `node_modules` y `.next`.
- Backup recuperable de PostgreSQL, independiente del backup de código/build.
- Espacio libre, política de retención y plan de recuperación aprobados.

El script instala dependencias, genera Prisma, aplica migraciones, compila, reinicia exclusivamente Senda y ejecuta su smoke test local. Puede eliminar backups antiguos según su retención: no ejecutarlo sin revisar ese efecto.

**El rollback del script no deshace migraciones de base de datos.** Un backup de build/dependencias no sustituye un backup de datos. Cambios de esquema incompatibles necesitan un plan propio de recuperación.

## Validación posterior

Comprobar el commit desplegado, estado del proceso y logs, además de:

- Login/logout de cuentas autorizadas.
- Acceso cliente e interno y aislamiento por proyecto.
- Dashboard, tareas y conversaciones.
- Asistente con documentación de prueba aprobada.
- Sincronización mediante token limitado a un proyecto de prueba.

Los smoke tests con escrituras deben usar un proyecto descartable aprobado, nunca un proyecto de cliente. Conservar los respaldos necesarios hasta la aceptación del release.

Si el host deja de responder, no iniciar instalaciones paralelas ni reiniciar servicios a ciegas. Investigar recursos y estado antes de reintentar.
