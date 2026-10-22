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
