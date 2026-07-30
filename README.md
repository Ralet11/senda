# Senda

Portal cliente para estudios de desarrollo.

Incluye:

- autenticacion por proyecto
- dashboard cliente
- chat por proyecto
- assistant con contexto del proyecto
- panel admin
- endpoint externo para updates desde agentes

## Stack

- Next.js 16
- React 19
- Prisma 7
- PostgreSQL

## Desarrollo local

Instalar dependencias:

```bash
npm install
```

Levantar en local:

```bash
npm run dev
```

Demo:

- cliente: `cliente@ejemplo.com` / `cliente1234`
- admin: `admin@senda.dev` / `admin1234`

## Base de datos

Generar cliente Prisma:

```bash
npx prisma generate
```

Aplicar migraciones:

```bash
npx prisma migrate deploy
```

Cargar seed:

```bash
npm run db:seed
```

## Variables de entorno

Tomar como base:

- [.env.example](./.env.example)
- [.env.production.example](./.env.production.example)

Variables importantes:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `SENDA_AGENT_TOKEN`

## Endpoint externo para agentes

Ruta:

```txt
POST /api/external/project-updates
```

Autenticacion:

```txt
Authorization: Bearer <SENDA_AGENT_TOKEN>
```

Sirve para crear drafts o publicar updates que luego impactan en el portal cliente.

## Deploy en EC2

Guia operativa:

- [docs/deploy-ec2.md](./docs/deploy-ec2.md)

Objetivo actual de produccion:

- `senda.prismadevs.com`
- Nginx como reverse proxy
- PM2 para el proceso Node
- PostgreSQL local del server
