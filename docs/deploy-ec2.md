# Deploy de Senda en EC2

Guia para levantar `senda.prismadevs.com` en el EC2 actual, sin Docker, usando:

- Node / Next.js
- PostgreSQL local
- PM2
- Nginx
- Certbot

## Supuestos

- Host: `ec2-3-142-93-72.us-east-2.compute.amazonaws.com`
- Usuario SSH: `ubuntu`
- Repo: `https://github.com/Ralet11/senda.git`
- Ruta objetivo: `/home/ubuntu/apps/senda/current`
- Puerto interno: `3010`
- Dominio publico: `senda.prismadevs.com`

## 1. Preparar carpeta del proyecto

```bash
mkdir -p /home/ubuntu/apps/senda
cd /home/ubuntu/apps/senda
git clone https://github.com/Ralet11/senda.git current
cd current
```

## 2. Instalar Node si hace falta

Verificar:

```bash
node -v
npm -v
```

Si no esta Node 20+, instalar antes de seguir.

## 3. Crear base y usuario en PostgreSQL local

Entrar a psql:

```bash
sudo -u postgres psql
```

Crear DB y usuario propios para Senda:

```sql
CREATE USER senda_user WITH ENCRYPTED PASSWORD 'CAMBIAR_PASSWORD';
CREATE DATABASE senda OWNER senda_user;
\c senda
GRANT ALL ON SCHEMA public TO senda_user;
```

## 4. Crear entorno de produccion

```bash
cd /home/ubuntu/apps/senda/current
cp .env.production.example .env.production
nano .env.production
```

Completar al menos:

```env
DATABASE_URL="postgresql://senda_user:CAMBIAR_PASSWORD@127.0.0.1:5432/senda?schema=public"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5"
SENDA_AGENT_TOKEN="token-largo-y-unico"
PROJECT_REPOS_ROOT="/home/ubuntu/repos"
NODE_ENV="production"
PORT="3010"
```

## 5. Instalar dependencias y compilar

```bash
cd /home/ubuntu/apps/senda/current
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

Si queres cargar datos demo:

```bash
npm run db:seed
```

No correr seed en produccion real con clientes, salvo que sea un entorno inicial de prueba.

## 6. Levantar con PM2

El repo ya incluye `ecosystem.config.cjs`.

```bash
cd /home/ubuntu/apps/senda/current
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
pm2 logs senda
```

Verificar que responda:

```bash
curl http://localhost:3010/login
```

## 7. Configurar Nginx

Crear un nuevo bloque. No modificar los bloques actuales salvo para agregar este.

Archivo sugerido:

```bash
sudo nano /etc/nginx/sites-available/senda
```

Contenido:

```nginx
server {
    server_name senda.prismadevs.com;

    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
    }

    listen 80;
}
```

Habilitar:

```bash
sudo ln -s /etc/nginx/sites-available/senda /etc/nginx/sites-enabled/senda
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Apuntar DNS

En la zona DNS de `prismadevs.com` crear:

- tipo: `A`
- host: `senda`
- valor: IP publica del EC2

## 9. Emitir SSL con Certbot

Cuando el DNS ya resuelva al EC2:

```bash
sudo certbot --nginx -d senda.prismadevs.com
```

Luego validar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 10. Checklist de validacion

Validar:

- `https://senda.prismadevs.com/login`
- login admin
- login cliente
- dashboard cliente
- chat
- assistant
- `POST /api/external/project-updates`
- assistant con una pregunta técnica sobre un repo dentro de `PROJECT_REPOS_ROOT`

## 11. Flujo de actualizacion de codigo

El unico metodo permitido para actualizar Senda es el script versionado. No ejecutar
manualmente `npm ci`, builds, migraciones o reinicios de PM2 en el EC2: en una
instancia pequena esos pasos pueden dejar `node_modules` a medio instalar si se
interrumpen.

Antes de publicar, desde un checkout local limpio:

```bash
npm run lint
npm run build
git push origin main
```

Luego, en el EC2 como `ubuntu`:

```bash
cd /home/ubuntu/apps/senda/current
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

El script verifica que el checkout este limpio, crea un backup de `.next` y
`node_modules`, hace `git merge --ff-only`, instala dependencias, genera Prisma,
aplica migraciones, compila y solo entonces reinicia el proceso PM2 `senda`.
Tambien ejecuta un smoke test local de `/login`. Si alguna etapa falla, restaura el
commit, dependencias y build anteriores, y reinicia exclusivamente Senda.

Los backups se conservan en `/home/ubuntu/apps/senda/backups/`; no borrarlos hasta
haber confirmado el deploy. El script no toca Nginx, PostgreSQL ni otras apps.

### Recuperacion ante host saturado

La instancia actual tiene recursos limitados. Si SSH/HTTPS dejan de responder durante
un build, no iniciar una segunda instalacion ni reiniciar PM2 a ciegas. Esperar a que
el host se recupere o revisar el estado desde AWS. Tras un reboot, verificar primero
que `node_modules/.bin/next` exista antes de iniciar Senda.

## 12. Comando de smoke test del endpoint externo

```bash
curl -X POST https://senda.prismadevs.com/api/external/project-updates \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "seed-project",
    "title": "Update desde agente",
    "summary": "Se publico una actualizacion de prueba desde el endpoint externo.",
    "kind": "CLIENT",
    "publish": true,
    "agentName": "manual-smoke-test"
  }'
```

## Notas

- No compartir la DB con otros proyectos.
- No reutilizar puertos ya usados (`3001`, `3005`, `4000`).
- Mantener Senda aislado en `3010`.
- `PROJECT_REPOS_ROOT` es obligatorio para habilitar búsquedas de código del assistant. Debe contener únicamente repos permitidos y nunca rutas amplias del servidor.
- El server actual ya tiene otros proyectos; cualquier cambio en Nginx debe pasar por `nginx -t` antes de recargar.
