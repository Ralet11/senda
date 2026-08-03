import ReactMarkdown, { type Components } from "react-markdown";

// Renders assistant-authored text only. Links, images and code blocks are stripped to plain
// text rather than rendered — Senda's backend already redacts paths/URLs/code before this text
// exists, and the UI shouldn't turn any that slips through into a clickable/renderable element.
const components: Components = {
  a: ({ children }) => <>{children}</>,
  img: () => null,
  code: ({ children }) => <>{children}</>,
  pre: ({ children }) => <>{children}</>,
  h1: ({ children }) => <p className="mt-2 text-[13px] font-semibold leading-5 first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mt-2 text-[13px] font-semibold leading-5 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mt-2 text-[13px] font-semibold leading-5 first:mt-0">{children}</p>,
  p: ({ children }) => <p className="mt-1.5 text-[13px] leading-5 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-5 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[13px] leading-5 first:mt-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => <blockquote className="mt-1.5 border-l-2 border-current/20 pl-2 text-[13px] italic leading-5 opacity-90 first:mt-0">{children}</blockquote>,
  hr: () => <hr className="my-2 border-current/10" />,
};

export function AssistantMarkdown({ content }: { content: string }) {
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}
