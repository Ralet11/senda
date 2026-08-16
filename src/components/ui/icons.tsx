/**
 * Set de iconos de Senda.
 *
 * Trazo de 1.6, esquinas redondeadas y caja de 24: todos los iconos comparten
 * peso óptico para que una fila de navegación se lea pareja. Se dibujan acá en
 * lugar de sumar una dependencia por diecisiete glifos.
 */

type IconProps = { className?: string; size?: number };

function Svg({ children, className, size = 18 }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </Svg>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z" />
    </Svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 6.1M17.5 15.3c2 .5 3.4 2 3.9 4.2" />
    </Svg>
  );
}

export function IconDocument(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h7.5L19 9v11.5H6Z" />
      <path d="M13.5 3.5V9H19" />
      <path d="M9 13h7M9 16.5h5" />
    </Svg>
  );
}

export function IconCheckSquare(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="m8 12 2.8 2.8L16.5 9" />
    </Svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9Z" />
      <path d="M18.5 16.5 19.2 18.8 21.5 19.5 19.2 20.2 18.5 22.5 17.8 20.2 15.5 19.5 17.8 18.8Z" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.6M12 16.1h.01" />
    </Svg>
  );
}

export function IconFlag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 21V4" />
      <path d="M6 4.5h11.5L15 9l2.5 4.5H6" />
    </Svg>
  );
}

export function IconMessage(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20.5 12c0 4.1-3.8 7.4-8.5 7.4a9.8 9.8 0 0 1-2.9-.4L4.5 20.5l1.3-3.6A7.1 7.1 0 0 1 3.5 12c0-4.1 3.8-7.4 8.5-7.4s8.5 3.3 8.5 7.4Z" />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9.5 6 5.5 6-5.5" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 5.5 6 6.5-6 6.5" />
    </Svg>
  );
}

export function IconPanelCollapse(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M10 4.5v15" />
      <path d="m16.5 9.8-2.2 2.2 2.2 2.2" />
    </Svg>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.5 5.5H19V11" />
      <path d="M18.5 6 11 13.5" />
      <path d="M18 14.5v3A1.5 1.5 0 0 1 16.5 19h-9A1.5 1.5 0 0 1 6 17.5v-9A1.5 1.5 0 0 1 7.5 7h3" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 19 6v6c0 3.9-2.8 7.2-7 8.5-4.2-1.3-7-4.6-7-8.5V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z" />
    </Svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 5.5h4A1.5 1.5 0 0 1 19.5 7v10a1.5 1.5 0 0 1-1.5 1.5h-4" />
      <path d="M10 15.5 13.5 12 10 8.5" />
      <path d="M13 12H4.5" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function IconAttachment(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17.5 10.5 11 17a3.5 3.5 0 0 1-5-5l7-7a2.5 2.5 0 0 1 3.5 3.5l-7 7a1.5 1.5 0 0 1-2-2l6.5-6.5" />
    </Svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19V5.5" />
      <path d="m6.5 11 5.5-5.5 5.5 5.5" />
    </Svg>
  );
}

export function IconGrip(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9.5" cy="7" r="1" fill="currentColor" />
      <circle cx="14.5" cy="7" r="1" fill="currentColor" />
      <circle cx="9.5" cy="12" r="1" fill="currentColor" />
      <circle cx="14.5" cy="12" r="1" fill="currentColor" />
      <circle cx="9.5" cy="17" r="1" fill="currentColor" />
      <circle cx="14.5" cy="17" r="1" fill="currentColor" />
    </Svg>
  );
}

export const NAV_ICONS = {
  home: IconHome,
  folder: IconFolder,
  users: IconUsers,
  document: IconDocument,
  tasks: IconCheckSquare,
  sparkles: IconSparkles,
  alert: IconAlert,
  flag: IconFlag,
  message: IconMessage,
  shield: IconShield,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
