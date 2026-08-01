# Assistant y contexto semántico

El assistant conserva el contexto operativo del proyecto y, cuando existe un índice, suma recuperación semántica con `pgvector`.

## Qué se indexa

- El resumen del proyecto.
- Milestones.
- Activity log.
- Updates publicados para el cliente.
- Mensajes y respuestas del assistant.

Los vectores se guardan en `ProjectContextChunk.embedding` usando `text-embedding-3-small` por defecto. Cada búsqueda está filtrada por `projectId`; nunca mezcla contexto entre proyectos.

## Operación

1. Configurar `OPENAI_API_KEY` y, opcionalmente, `OPENAI_EMBEDDING_MODEL` en `.env.production`.
2. Publicar únicamente con `scripts/deploy.sh`; la migración habilita `pgvector` y agrega las columnas necesarias.
3. Desde `/admin/projects/<projectId>`, usar **Reindexar contexto** tras cargar o cambiar el brief, hitos, actividad o updates existentes.

Los nuevos mensajes del assistant se embeben automáticamente. Si esa llamada a OpenAI falla, el mensaje se conserva y una reindexación posterior lo recupera.

## Investigacion de implementacion

Para preguntas sobre como funciona el producto, el assistant puede contrastar la respuesta con el repositorio local enlazado al proyecto. No indexa ni expone codigo: usa una investigacion acotada y de solo lectura.

El flujo tiene dos etapas:

1. Busca archivos relevantes y sigue un conjunto pequeno de dependencias locales.
2. Un analista interno transforma esa evidencia en hallazgos funcionales; el chat del cliente recibe solamente esos hallazgos, nunca excerpts, rutas, codigo ni detalles de infraestructura.

La lectura esta limitada a 250 archivos candidatos, 8 piezas de evidencia y archivos de hasta 256 KB. Excluye directorios generados, dependencias, Git, archivos `.env`, claves, certificados, credenciales y respaldos. Las respuestas tecnicas deben indicar limites cuando no haya evidencia suficiente; el assistant no debe prometer una verificacion que no realizo.

Para habilitarlo en un entorno, `PROJECT_REPOS_ROOT` debe apuntar al directorio padre controlado que contiene los repositorios. `Project.repoLocalPath` siempre se resuelve dentro de ese directorio; una ruta que intente salir de el se rechaza.

## Alcance inicial

El indice semantico es manual y cubre datos de Senda en PostgreSQL. La investigacion del repositorio es un complemento de solo lectura para preguntas tecnicas: no crea un indice de codigo ni permite acceder a repositorios externos fuera de la raiz configurada.
