import Link from "next/link";
import { ConversationRail, RailItem } from "@/components/conversation/conversation-frame";
import { IconPlus } from "@/components/ui/icons";

export function AssistantRail({
  projectId,
  sessions,
  activeSessionId,
}: {
  projectId: string;
  sessions: Array<{ id: string; title: string; updatedAt: string }>;
  activeSessionId: string;
}) {
  const base = `/projects/${projectId}/assistant`;

  return (
    <ConversationRail
      title="Senda AI"
      action={
        <Link href={`${base}?new=1`} prefetch={false} className="sd-icon-btn h-7 w-7" aria-label="Nueva conversación">
          <IconPlus size={15} />
        </Link>
      }
    >
      <Link href={`${base}?new=1`} prefetch={false} className="mb-2 block">
        <span className="sd-btn sd-btn-outline w-full">
          <IconPlus size={15} />
          Nueva conversación
        </span>
      </Link>

      {sessions.length === 0 ? (
        <p className="px-2.5 py-3 text-[12.5px] text-ink-3">Todavía no hay conversaciones guardadas.</p>
      ) : (
        sessions.map((session) => (
          <Link key={session.id} href={`${base}?session=${session.id}`}>
            <RailItem active={session.id === activeSessionId} title={session.title} meta={session.updatedAt} />
          </Link>
        ))
      )}
    </ConversationRail>
  );
}
