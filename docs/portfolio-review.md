# Recorrido de demostración y revisión

## Antes de mostrarlo

1. Usar una base local descartable, migrada y cargada con el seed demo.
2. Entrar como cliente y recorrer proyecto, hitos, tareas y conversaciones.
3. Cerrar sesión; entrar como administrador y mostrar el espacio interno.
4. Crear una tarea de ejemplo y observar su representación desde la cuenta cliente.
5. Mostrar el contrato de sincronización y la documentación curada, sin revelar un token.
6. Si hay una clave propia configurada y presupuesto autorizado, demostrar el asistente. De lo contrario, explicar la integración sin simular una respuesta real.

## Qué conviene explicar en una entrevista

- Cómo se separan las capacidades del cliente y del equipo interno.
- Por qué el backend comprueba membresía en lugar de depender de controles visuales.
- Qué aporta la idempotencia cuando una CLI reintenta una sincronización.
- Por qué los agentes crean borradores y no publican una novedad automáticamente.
- Qué cambiaría al pasar de una única instancia a varias: rate limiting compartido, almacenamiento y observabilidad.

Atribuir únicamente el trabajo realizado personalmente. El repositorio por sí solo no prueba autoría individual, volumen de usuarios, aceptación comercial ni resultados de negocio.

## Cobertura y pendientes

Las pruebas automatizadas de la CLI, las barreras del seed y las utilidades de rate limiting, contraseñas y adjuntos cubren comportamientos acotados. No reemplazan tests de integración de autorizaciones, persistencia, chat ni evaluación del asistente.

Antes de compartir una demo alojada, verificar de forma aislada:

- Usuario ajeno al proyecto no puede leer ni modificar sus recursos.
- Sesión caducada, usuario desactivado y logout se respetan.
- Repetir una sincronización con la misma clave de idempotencia no duplica datos.
- Cancelar y repetir navegación no deja modales ni borradores inconsistentes.
- Adjuntos inválidos o demasiado grandes se rechazan.
- No aparecen credenciales, información operativa interna ni datos de clientes en capturas.

La guía de despliegue es documentación operativa, no evidencia de que un release esté publicado o aceptado.

## Pruebas de navegador reproducibles

```bash
npx playwright install chromium
npm run build
npm run test:browser
```

La suite inicia un servidor de producción local en `127.0.0.1:3212`, sin clave de IA y sin conectar una base real. Cubre vista escritorio/móvil, acceso sin sesión, redirección de registro, persistencia del tema y recuperación de errores de red/respuestas inválidas. Los dos últimos casos interceptan HTTP a propósito: no son evidencia de autenticación real.

Si el entorno tiene un Chromium instalado, se puede seleccionar mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Las pruebas requieren que el entorno permita iniciar procesos de navegador y sus sockets temporales. La CI también ejecuta esta suite, pero debe comprobarse el resultado del commit específico antes de declararla pasada.

## Revisión de dependencias (22 de octubre de 2026)

Next.js se actualizó de 16.2.12 a 16.3.8, junto con eslint-config-next, dentro de la misma versión mayor. El inventario previo incluía avisos críticos del framework; el inventario posterior ya no reportó críticos. Referencias: [Windows](https://github.com/advisories/GHSA-p293-qw3h-jr36), [AVIF](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [ImageResponse](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).

Quedan **7 entradas high en npm audit --omit=dev**, no siete explotaciones comprobadas: prisma, @prisma/config, deepmerge-ts, fast-uri, mysql2, nanoid y source-map-js. Prisma está declarado como herramienta de desarrollo pero también aparece como peer opcional de @prisma/client; mysql2/fast-uri/deepmerge-ts llegan por ese árbol. nanoid/source-map-js llegan por PostCSS, usado por Next y tooling CSS. El proyecto usa PostgreSQL, no se encontró uso directo de next/og ni next/image, y no se verificó la exposición del entorno desplegado. Estos hechos no prueban ausencia de riesgo.

La remediación pendiente requiere revisar transitivos y compatibilidad de Prisma; no se forzaron overrides, cambios mayores ni cambios de producción. Este inventario fechado no sustituye un análisis de alcance, una auditoría de seguridad ni aceptación de producción.
