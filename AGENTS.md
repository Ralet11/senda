<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deploy de produccion

- El deploy de Senda se ejecuta **solo** en el EC2 y mediante `scripts/deploy.sh`.
- Antes de publicar, ejecutar localmente `npm run lint` y `npm run build`.
- No ejecutar manualmente en produccion `npm ci`, `next build`, `prisma migrate deploy` ni `pm2 restart senda`.
- El script puede tocar exclusivamente el checkout de Senda y el proceso PM2 `senda`; no modificar Nginx, PostgreSQL, PM2 global ni otras aplicaciones del host.
- No desplegar si el checkout remoto tiene cambios sin commitear o si faltan `.env.production`, `node_modules` o `.next`; investigar primero.
- Tras el deploy, verificar los smoke tests del script y el estado de PM2. Si falla, conservar el directorio de backup que el script informa; no eliminarlo automaticamente.
