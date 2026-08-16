# Assistant y documentación de proyectos

Senda responde preguntas funcionales desde documentación explícita y apta para clientes. No inspecciona ni indexa el código fuente del proyecto.

## Fuente autorizada

Cada repositorio enlazado debe incluir documentación funcional aprobada en `.senda/knowledge/`:

```text
.senda/
  knowledge/
    README.md
    faq.md
    glossary.md
    domains/
      usuarios.md
      pagos.md
```

La forma recomendada de crearla es `npx @prismadevs/senda-cli init --project-id <id>`.

`README.md` presenta el producto. Los documentos de `domains/` explican flujos, reglas, límites y capacidades. La documentación no debe contener secretos, código, rutas internas ni instrucciones para el modelo. Los manifiestos operativos y las instrucciones para agentes quedan fuera de `knowledge/`, por lo que Senda AI nunca los lee.

Senda admite hasta 48 documentos de 128 KB cada uno. Divide el contenido por encabezados Markdown y selecciona como máximo ocho secciones relacionadas con la pregunta. La respuesta sólo se acepta cuando el modelo puede vincular cada afirmación con una sección recuperada.

## Preguntas sin respuesta

Cuando no hay documentación suficiente, el assistant lo indica y ofrece **Enviar esta pregunta a Prisma**. La acción es siempre explícita: Senda no envía nada automáticamente.

La pregunta aparece en `/admin/inbox`. Cuando el equipo responde:

1. `ProjectQuestion` queda en estado `ANSWERED`.
2. La respuesta se agrega a la conversación original.
3. El equipo puede usar esa consulta como señal para actualizar la documentación del proyecto.

## Estado operativo

Las preguntas sobre fase, avance, hitos y actividad se responden directamente desde PostgreSQL. Esa información cambia con frecuencia y no se duplica dentro de `.senda/`.

## Sincronización documental

Senda no clona ni almacena el repositorio del cliente. La CLI envía exclusivamente el snapshot de `.senda/knowledge/**/*.md` a través de una clave revocable y limitada a ese proyecto. El resto del repositorio, incluido código, Git, secretos y archivos de infraestructura, nunca llega al EC2 de Senda.
