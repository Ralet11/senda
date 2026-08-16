# Senda CLI

Inicializa la documentación funcional aprobada y los manifiestos operativos que un agente puede sincronizar con Senda.

```bash
npx @prismadevs/senda-cli init --project-id <id>
npx @prismadevs/senda-cli validate
SENDA_TOKEN=senda_pt_... npx @prismadevs/senda-cli push all --apply
```

`SENDA_TOKEN` nunca se guarda en `.senda/` ni en Git. Senda AI únicamente lee `.senda/knowledge/**/*.md`; no lee código ni los manifiestos de sincronización.
