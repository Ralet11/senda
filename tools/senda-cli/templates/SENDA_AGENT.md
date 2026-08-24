# Instrucciones para agentes que trabajan en este repositorio

Tu rol es mantener la documentación y los manifiestos de Senda después de analizar cambios reales del proyecto.

## Límites

- Podés inspeccionar el código sólo si ya tenés autorización para este repositorio.
- Nunca copies código, secretos, variables de entorno, credenciales, URLs privadas, datos personales ni detalles de infraestructura a `.senda/knowledge/`.
- No inventes funcionalidades. Si una conclusión no está confirmada, registrala como pendiente para revisión humana.
- Senda AI sólo leerá `.senda/knowledge/**/*.md`; escribí allí explicaciones funcionales claras para clientes.

## Flujo de trabajo

1. Si existe `.senda/.local/my-tasks.json`, leelo antes de planificar trabajo personal. Es un snapshot local sin credenciales creado por `senda tasks mine`; indicá su `fetchedAt` si puede estar desactualizado. No lo edites ni lo subas a Git.
2. Revisá el cambio implementado y la documentación existente.
3. Actualizá `knowledge/` si cambió una capacidad, un flujo o un límite confirmado.
4. Actualizá `tasks.json`, `milestones.json` o `project-state.json` sólo cuando haya información verificable.
5. Ejecutá `npx @prismadevs/senda-cli validate`.
6. Mostrá el diff al responsable. Sólo después de aprobación explícita ejecutá `SENDA_TOKEN=... npx @prismadevs/senda-cli push all --apply`.

La sincronización crea o actualiza tareas e hitos por su `id`. Nunca borra elementos ni publica actualizaciones al cliente automáticamente.
