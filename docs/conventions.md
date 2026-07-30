# Convenciones

Se va completando a medida que surgen decisiones concretas de estilo/patrones en el
código. Por ahora:

- TypeScript estricto, sin `any` salvo justificación puntual.
- Server actions / route handlers hacen la validación de input (no confiar en el cliente).
- Cada route group (`(auth)`, `(client)`, `(admin)`) controla su propio acceso —
  ver middleware de auth cuando se implemente.
- Multi-tenancy: toda query que toque datos de un proyecto debe filtrar por
  `projectId` a través de la membresía del usuario autenticado, nunca confiar en un
  `projectId` de la URL sin verificar pertenencia.
