# Features

Panel web para que los clientes de Senda vean el estado de su proyecto, se comuniquen
con el equipo, y discutan ideas con un AI assistant que conoce el contexto del proyecto.

## MVP

### 1. Autenticación y cuentas
- Login/registro (email + password o magic link) para clientes.
- Un usuario puede pertenecer a uno o varios proyectos.
- Roles: `ADMIN` (Ramiro/equipo interno) y `CLIENT`.
- Recuperación de contraseña.

### 2. Portal del cliente — dashboard del proyecto
- Resumen general: fase actual (Discovery / Diseño / Desarrollo / QA / Lanzamiento) y % de avance.
- Timeline / hitos con fecha estimada.
- "En qué se está trabajando ahora": tareas activas y quién las lleva.
- Equipo asignado visible (foto, nombre, rol).
- Historial de actividad tipo changelog.
- Links a entregables (staging, documentos, diseños).

### 3. Canal de comunicación
- Chat/comentarios por proyecto (un hilo por proyecto, no DMs 1 a 1).
- Notificación cuando el equipo responde.
- Adjuntar archivos/imágenes.

### 4. AI assistant (por proyecto)
- Conocimiento funcional desde documentación curada en `.senda/**/*.md`.
- Estado operativo desde PostgreSQL: fase, avance, hitos y actividad.
- El cliente puede preguntar estado, discutir ideas, pedir aclaraciones.
- Si falta documentación, el cliente puede enviar la pregunta a Prisma para recibir una respuesta humana.
- Detecta pedidos accionables y los convierte en una "propuesta" para el equipo interno.
- Historial de conversación persistente por proyecto.

### 5. Panel interno (Ramiro / equipo)
- Bandeja de propuestas generadas por el AI assistant → aceptar / convertir en tarea / descartar.
- CRUD de proyectos: crear, invitar cliente, asignar equipo.
- Actualizar fase/avance/tareas activas a mano.
- Ver todos los chats de todos los proyectos en un solo lugar.

### 6. Notificaciones
- Email cuando: el cliente escribe, el AI genera una propuesta, cambia el estado del proyecto.

## Fase 2 (no construir todavía)
- Integración automática con GitHub/Linear para status en tiempo real.
- Facturación/pagos dentro del portal.
- Multi-idioma.
- App móvil.
- Notificaciones push / WhatsApp.
