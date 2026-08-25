# Senda CLI

Inicializa la documentación funcional aprobada y los manifiestos operativos que un agente puede sincronizar con Senda.

```bash
npx @prismadevs/senda-cli init --project-id <id>
npx @prismadevs/senda-cli validate
SENDA_TOKEN=senda_pt_... npx @prismadevs/senda-cli push all --apply
```

`init` crea tambiÃ©n `.senda/SENDA_COMMANDS.txt`, una referencia local completa de comandos y reglas de uso.

## Trabajo personal de desarrolladores

La clave del repositorio (`SENDA_TOKEN`) no sirve para tareas personales. Desde la carpeta que contiene `.senda/`, cada desarrollador inicia una sesión una única vez:

```bash
senda login
```

La CLI verifica la cuenta de Senda, crea una clave personal revocable y la guarda en el almacén seguro del sistema operativo. No queda en Git, `.senda/`, `.env` ni en el contexto del agente. Para quitar el acceso local ejecutá `senda logout`.

Después, tanto el desarrollador como el agente pueden usar estos comandos sin token visible:

```bash
senda tasks pull
senda tasks mine
```

`SENDA_DEV_TOKEN` sigue siendo una alternativa temporal para automatizaciones controladas, pero no es necesario para el flujo habitual.

```bash
# Ver Ãºnicamente mis tareas asignadas en el proyecto configurado en .senda/
senda tasks mine

# Ver ideas libres y reclamar trabajo de forma atÃ³mica
senda tasks available
senda tasks claim <task-id>

# Reclamar las primeras 4 ideas libres, todas, o una lista concreta de IDs
senda tasks claim 4
senda tasks claim all
senda tasks claim id-1,id-2,id-3

# Informar avance o dejar contexto para el equipo
senda tasks status <task-id> APPLIED
senda tasks note <task-id> "Validé el flujo y queda pendiente revisión"
```

Cada `tasks pull` o `tasks mine` guarda un snapshot local sin credenciales en `.senda/.local/my-tasks.json`. La CLI crea `.senda/.gitignore` para excluirlo de Git; así un agente autorizado en el mismo repositorio puede leer las tareas sin recibir credenciales.

Si dos personas intentan reclamar la misma idea, Senda asigna la tarea a una sola. En reclamos mÃºltiples, las tareas que siguen libres se reclaman y las que otro dev tomÃ³ se informan al final, sin deshacer las demÃ¡s.

`SENDA_TOKEN` nunca se guarda en `.senda/` ni en Git. Senda AI únicamente lee `.senda/knowledge/**/*.md`; no lee código ni los manifiestos de sincronización.
