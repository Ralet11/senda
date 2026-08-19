# Senda CLI

Inicializa la documentación funcional aprobada y los manifiestos operativos que un agente puede sincronizar con Senda.

```bash
npx @prismadevs/senda-cli init --project-id <id>
npx @prismadevs/senda-cli validate
SENDA_TOKEN=senda_pt_... npx @prismadevs/senda-cli push all --apply
```

## Trabajo personal de desarrolladores

La clave del repositorio (`SENDA_TOKEN`) no sirve para tareas personales. Cada desarrollador crea su propia clave revocable en **Senda > Senda CLI** y la guarda sÃ³lo en su entorno como `SENDA_DEV_TOKEN`.

```bash
# Ver Ãºnicamente mis tareas asignadas en el proyecto configurado en .senda/
SENDA_DEV_TOKEN=senda_dt_... npx @prismadevs/senda-cli tasks mine

# Ver ideas libres y reclamar una de forma atÃ³mica
SENDA_DEV_TOKEN=senda_dt_... npx @prismadevs/senda-cli tasks available
SENDA_DEV_TOKEN=senda_dt_... npx @prismadevs/senda-cli tasks claim <task-id>

# Informar avance o dejar contexto para el equipo
SENDA_DEV_TOKEN=senda_dt_... npx @prismadevs/senda-cli tasks status <task-id> APPLIED
SENDA_DEV_TOKEN=senda_dt_... npx @prismadevs/senda-cli tasks note <task-id> "ValidÃ© el flujo y queda pendiente revisiÃ³n"
```

Si dos personas intentan reclamar la misma idea, Senda asigna la tarea a una sola y la otra CLI recibe un conflicto sin modificar nada.

`SENDA_TOKEN` nunca se guarda en `.senda/` ni en Git. Senda AI únicamente lee `.senda/knowledge/**/*.md`; no lee código ni los manifiestos de sincronización.
