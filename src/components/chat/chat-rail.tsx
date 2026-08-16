"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConversationRail, RailGroupLabel, RailItem } from "@/components/conversation/conversation-frame";
import { IconPlus } from "@/components/ui/icons";

export type RailConversation = { id: string; label: string };

export function ChatRail({
  projectId,
  conversations,
  availableMembers,
  activeConversationId,
}: {
  projectId: string;
  conversations: RailConversation[];
  availableMembers: Array<{ id: string; name: string }>;
  activeConversationId?: string;
}) {
  const router = useRouter();
  const base = `/projects/${projectId}/chat`;
  const [picking, setPicking] = useState(false);
  const [member, setMember] = useState("");
  const [creating, setCreating] = useState(false);

  async function createDirect() {
    if (!member) return;
    setCreating(true);
    const response = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, memberId: member }),
    });
    const data = (await response.json().catch(() => null)) as { conversation?: { id: string } } | null;
    setCreating(false);
    if (response.ok && data?.conversation) {
      setPicking(false);
      router.push(`${base}?conversation=${data.conversation.id}`);
      router.refresh();
    }
  }

  return (
    <ConversationRail
      title="Conversaciones"
      action={
        availableMembers.length > 0 ? (
          <button
            type="button"
            onClick={() => setPicking((value) => !value)}
            className="sd-icon-btn h-7 w-7"
            aria-label="Nueva conversación directa"
          >
            <IconPlus size={15} />
          </button>
        ) : null
      }
    >
      {picking ? (
        <div className="mb-2 space-y-2 rounded-panel border border-line p-2.5">
          <select value={member} onChange={(event) => setMember(event.target.value)}>
            <option value="">Elegí una persona</option>
            {availableMembers.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createDirect}
            disabled={!member || creating}
            className="sd-btn sd-btn-primary sd-btn-sm w-full"
          >
            {creating ? "Abriendo…" : "Abrir chat"}
          </button>
        </div>
      ) : null}

      <Link href={base}>
        <RailItem active={!activeConversationId} title="Equipo Senda" meta="Canal del proyecto" />
      </Link>

      {conversations.length > 0 ? <RailGroupLabel>Directos</RailGroupLabel> : null}
      {conversations.map((conversation) => (
        <Link key={conversation.id} href={`${base}?conversation=${conversation.id}`}>
          <RailItem
            active={activeConversationId === conversation.id}
            title={conversation.label}
            meta="Conversación privada"
          />
        </Link>
      ))}
    </ConversationRail>
  );
}
