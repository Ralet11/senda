# CLI de Senda y sincronización de agentes

`@prismadevs/senda-cli` prepara un repositorio para dos usos separados:

- **Senda AI** consulta sólo `.senda/knowledge/**/*.md`, documentación funcional curada para clientes.
- Un **agente autorizado del repositorio** puede usar `.senda/SENDA_AGENT.md` y los manifiestos JSON para proponer y sincronizar trabajo. Esos archivos nunca se envían al modelo.

## Inicio

```bash
npx @prismadevs/senda-cli init --project-id <id-de-senda>
```

El comando crea `.senda/`. Esa carpeta debe versionarse con el proyecto, salvo los secretos: no se guarda ningún token en ella ni en Git.

## Trabajo del agente

1. Analiza cambios con la autorización normal del repositorio.
2. Actualiza la documentación funcional confirmada en `knowledge/`.
3. Prepara tareas en `tasks.json`, hitos en `milestones.json` y estado en `project-state.json`.
4. Ejecuta `senda validate`.
5. Muestra el diff para revisión humana.
6. Sólo con autorización explícita sincroniza con `senda push all --apply`. Para actualizar únicamente la base de Senda AI usa `senda push knowledge --apply`.

Los identificadores de tareas e hitos son estables: una nueva sincronización actualiza el mismo elemento y nunca borra los que no estén presentes.

## Credenciales y permisos

Un administrador crea una clave en la pestaña **Configuración** del proyecto. La clave:

- es única por proyecto y se muestra una sola vez;
- se guarda solamente en `SENDA_TOKEN` (entorno local o secreto del CI);
- tiene permisos mínimos por recurso: tareas, hitos, estado y/o borradores;
- se puede revocar sin afectar otros proyectos;
- no puede publicar un update al cliente; los updates generados por agentes siempre quedan en borrador.

La API exige HTTPS, `Authorization: Bearer`, una clave de idempotencia y valida el proyecto asociado al token. Cada envío queda auditado en Senda.
