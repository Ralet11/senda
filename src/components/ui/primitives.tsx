import Link from "next/link";
import { avatarHue, cn, getInitials } from "@/lib/ui";

/* -------------------------------------------------------------------------- */
/* Encabezados                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Encabezado de página. Es lo único que ocupa el ancho completo arriba del
 * contenido; las acciones viven acá y no repartidas por la pantalla.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-3">{eyebrow}</div> : null}
        <h1 className="text-[27px] font-semibold leading-tight">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * Título de sección dentro de una página. Sin caja: una línea de texto y una
 * regla. Es lo que reemplaza al patrón de "card con header" anidada.
 */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("sd-label", className)}>{children}</p>;
}

/* -------------------------------------------------------------------------- */
/* Contenedores                                                                */
/* -------------------------------------------------------------------------- */

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <section className={cn("sd-panel", padded && "p-5", className)}>{children}</section>;
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-panel border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium text-ink-2">{title}</p>
      {hint ? <p className="max-w-sm text-[13px] text-ink-3">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Estado                                                                      */
/* -------------------------------------------------------------------------- */

type Tone = "neutral" | "accent" | "positive" | "warn" | "danger" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-raised text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  positive: "bg-positive-soft text-positive",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Chip({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("sd-chip", TONE_CLASS[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/**
 * Dato suelto con su etiqueta. Sustituye a las "cajitas de KPI": el número
 * manda, la etiqueta lo describe y nada lo encierra.
 */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="sd-label">{label}</p>
      <p className="sd-numeric mt-1.5 text-[22px] font-semibold leading-none">{value}</p>
      {hint ? <p className="mt-1.5 truncate text-[12.5px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

/**
 * Dato cualitativo: lo que se lee es el texto, no una cifra. Es el par de
 * `Stat` para hechos como "próximo hito" o "contacto del cliente".
 */
export function Fact({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="sd-label">{label}</p>
      <div className="mt-1.5 text-[13.5px] font-medium leading-snug">{children}</div>
      {hint ? <p className="mt-1 text-[12.5px] font-normal text-ink-3">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Avance                                                                      */
/* -------------------------------------------------------------------------- */

export function ProgressRing({
  value,
  size = 108,
  caption,
}: {
  value: number;
  size?: number;
  caption?: string;
}) {
  const stroke = size < 70 ? 5 : 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.min(100, Math.max(0, value));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safe / 100)}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.32,.72,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="sd-numeric text-[19px] font-semibold leading-none">{safe}%</span>
        {caption ? <span className="mt-1 text-[11px] text-ink-3">{caption}</span> : null}
      </div>
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${safe}%`, transition: "width .5s cubic-bezier(.32,.72,0,1)" }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Personas                                                                    */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const hue = avatarHue(name);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: `color-mix(in oklab, hsl(${hue} 62% 48%) 18%, var(--surface))`,
        color: `hsl(${hue} 58% var(--avatar-l, 38%))`,
        boxShadow: "inset 0 0 0 1px var(--line)",
      }}
      title={name}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

/** Fila compacta de personas. Reemplaza la card de "equipo asignado". */
export function PeopleStrip({
  people,
  max = 6,
}: {
  people: Array<{ id: string; name: string; role?: string }>;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {shown.map((person) => (
        <div key={person.id} className="flex min-w-0 items-center gap-2.5">
          <Avatar name={person.name} size={30} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-medium">{person.name}</p>
            {person.role ? <p className="truncate text-[11.5px] text-ink-3">{person.role}</p> : null}
          </div>
        </div>
      ))}
      {rest > 0 ? <span className="text-[12.5px] text-ink-3">+{rest} más</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cronología y actividad                                                      */
/* -------------------------------------------------------------------------- */

export type TimelineItem = {
  id: string;
  title: string;
  meta?: string;
  state: "done" | "current" | "pending";
};

/**
 * Los hitos se leen como una línea: dónde estuvimos, dónde estamos, hacia dónde
 * vamos. Una card por hito rompe justamente esa lectura.
 */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative">
      {items.map((item, index) => {
        const last = index === items.length - 1;

        return (
          <li key={item.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border-2",
                  item.state === "done" && "border-accent bg-accent",
                  item.state === "current" && "border-accent bg-surface",
                  item.state === "pending" && "border-line-strong bg-surface",
                )}
              >
                {item.state === "done" ? (
                  <svg viewBox="0 0 10 10" className="h-2 w-2 text-on-accent" aria-hidden="true">
                    <path
                      d="M1.5 5.2 3.9 7.5 8.5 2.6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
                {item.state === "current" ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              </span>
              {!last ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
            </div>

            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "text-[13.5px]",
                    item.state === "pending" ? "text-ink-2" : "font-medium",
                  )}
                >
                  {item.title}
                </p>
                {item.state === "current" ? (
                  <Chip tone="accent" className="text-[10px]">
                    PRÓXIMO
                  </Chip>
                ) : null}
              </div>
              {item.meta ? <p className="mt-0.5 text-[12.5px] text-ink-3">{item.meta}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * La actividad se lee como una historia, no como una lista de tarjetas: la
 * fecha a la izquierda, el hecho a la derecha.
 */
export function Feed({
  items,
}: {
  items: Array<{ id: string; when: string; text: string; detail?: string | null }>;
}) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
          <p className="shrink-0 text-[12px] text-ink-3">{item.when}</p>
          <div className="min-w-0">
            <p className="text-[13.5px] leading-relaxed">{item.text}</p>
            {item.detail ? <p className="mt-0.5 text-[12.5px] text-ink-3">{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Mensajería de resultado                                                     */
/* -------------------------------------------------------------------------- */

export function Notice({ tone, children }: { tone: "positive" | "danger"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-control border px-3.5 py-2.5 text-[13px]",
        tone === "positive"
          ? "border-positive/25 bg-positive-soft text-positive"
          : "border-danger/25 bg-danger-soft text-danger",
      )}
    >
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Campo de formulario                                                         */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[12.5px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11.5px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Enlace de navegación en línea                                               */
/* -------------------------------------------------------------------------- */

export function QuietLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("text-[13px] font-medium text-accent-ink hover:text-accent", className)}
    >
      {children}
    </Link>
  );
}
