type ConversationFrameProps = { children: React.ReactNode };

export function ConversationFrame({ children }: ConversationFrameProps) {
  return <section className="h-screen min-h-[520px] bg-white">{children}</section>;
}
