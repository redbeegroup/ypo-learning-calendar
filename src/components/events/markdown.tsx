import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  if (!children.trim()) return <p className="text-muted-foreground">No description provided.</p>;
  return (
    <div className="prose prose-slate max-w-none prose-a:text-primary prose-headings:font-semibold">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
