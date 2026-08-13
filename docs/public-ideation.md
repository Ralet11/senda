# Prisma Session: ideacion publica

Senda expone un modulo publico y aislado para la experiencia conversacional de `prismadevs.com`.

## Arquitectura

```txt
prismadevs.com
  -> POST /api/public/ideation
  -> Senda (Next.js / EC2)
  -> OpenAI Responses API
```

El endpoint no usa autenticacion de Senda, no consulta proyectos ni expone informacion del portal. Tiene validacion de origen, limite por IP y hasta diez intercambios por sesion: primero construye el mapa y luego permite corregirlo o profundizarlo.

## Variables

```env
OPENAI_API_KEY="sk-..."
PRISMA_IDEATION_MODEL="gpt-5.6-terra"
PRISMA_IDEATION_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,https://prismadevs.com,https://www.prismadevs.com"
```

La clave solo se configura en Senda. Nunca se coloca en el HTML, Vite ni variables publicas del navegador.

No existe modo simulado ni respuesta deterministica. Si `OPENAI_API_KEY` no esta configurada, el endpoint responde `503` y la interfaz informa que Prisma AI no esta disponible. Toda respuesta exitosa proviene de OpenAI Responses API.

## Desarrollo local

Terminal 1, desde Senda:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Terminal 2, desde Prisma:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Configurar `OPENAI_API_KEY` antes de iniciar Senda.

## Contrato

Request:

```json
{ "sessionId": "opcional", "message": "Quiero construir..." }
```

La respuesta incluye el mensaje de Prisma, fase conversacional, sugerencias opcionales, mapa acumulativo del producto, nombre elegido, presupuesto declarado por la persona, tiempo preliminar cuando existe suficiente contexto y el indicador `readyForHandoff`. El modelo no calcula ni sugiere precios.

## Limites del MVP

Las sesiones se conservan en memoria durante 30 minutos. Esto funciona con el proceso unico actual de PM2. Antes de escalar horizontalmente, mover el estado efimero a Redis o PostgreSQL. El rango de tiempo es preliminar y siempre se presenta como sujeto a revision humana; la propuesta economica se conversa con Prisma a partir del presupuesto declarado.
