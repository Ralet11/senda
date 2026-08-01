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

## Alcance inicial

El índice es manual y cubre datos de Senda en PostgreSQL. La búsqueda léxica del repo sigue siendo un complemento para preguntas técnicas; no se indexa código ni archivos de repositorios externos en esta etapa.
