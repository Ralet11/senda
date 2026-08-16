# Assistant y documentación de proyectos

Senda responde preguntas funcionales desde documentación explícita y apta para clientes. No inspecciona ni indexa el código fuente del proyecto.

## Fuente autorizada

Cada repositorio enlazado debe incluir un directorio `.senda/` con archivos Markdown:

```text
.senda/
  README.md
  faq.md
  glossary.md
  domains/
    usuarios.md
    pagos.md
  decisions/
    reglas-importantes.md
```

Hay archivos iniciales para copiar en [`docs/project-knowledge-template`](./project-knowledge-template/README.md).

`README.md` presenta el producto. Los documentos de `domains/` explican flujos, reglas, límites y capacidades. La documentación no debe contener secretos, código, rutas internas ni instrucciones para el modelo.

Senda admite hasta 48 documentos de 128 KB cada uno. Divide el contenido por encabezados Markdown y selecciona como máximo ocho secciones relacionadas con la pregunta. La respuesta sólo se acepta cuando el modelo puede vincular cada afirmación con una sección recuperada.

## Preguntas sin respuesta

Cuando no hay documentación suficiente, el assistant lo indica y ofrece **Enviar esta pregunta a Prisma**. La acción es siempre explícita: Senda no envía nada automáticamente.

La pregunta aparece en `/admin/inbox`. Cuando el equipo responde:

1. `ProjectQuestion` queda en estado `ANSWERED`.
2. La respuesta se agrega a la conversación original.
3. El equipo puede usar esa consulta como señal para actualizar la documentación del proyecto.

## Estado operativo

Las preguntas sobre fase, avance, hitos y actividad se responden directamente desde PostgreSQL. Esa información cambia con frecuencia y no se duplica dentro de `.senda/`.

## Repositorios

`PROJECT_REPOS_ROOT` debe apuntar a un directorio controlado exclusivamente por Senda. `Project.repoLocalPath` siempre se resuelve como descendiente estricto de esa raíz.

Para mirrors propios:

1. Configurar `Project.repoUrl` con el remoto SSH.
2. Guardar una deploy key de sólo lectura en `SENDA_REPO_KEYS_DIR/<projectId>`.
3. Ejecutar `npm run repos:sync` para clonar o actualizar el mirror.
4. Programar la sincronización periódica en el EC2.

Las claves viven fuera de `PROJECT_REPOS_ROOT`. La lectura del assistant queda limitada a `.senda/**/*.md`.
