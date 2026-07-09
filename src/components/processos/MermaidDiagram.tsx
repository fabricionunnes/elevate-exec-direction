import { useEffect, useId, useState } from "react";

let mermaidModule: Promise<typeof import("mermaid")> | null = null;
const loadMermaid = () => (mermaidModule ??= import("mermaid"));

interface MermaidDiagramProps {
  code: string;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let alive = true;
    loadMermaid()
      .then(async (m) => {
        const mermaid = m.default;
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isDark ? "dark" : "neutral",
          fontFamily: "inherit",
          flowchart: { curve: "basis" },
        });
        const { svg } = await mermaid.render(`mmd${reactId}`, code.trim());
        if (alive) setSvg(svg);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [code, reactId]);

  if (failed) {
    return (
      <pre className="my-4 overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs">
        {code}
      </pre>
    );
  }
  if (!svg) {
    return <div className="my-4 h-48 animate-pulse rounded-lg border bg-muted/40" />;
  }
  return (
    <div
      className="my-4 overflow-x-auto rounded-lg border bg-card p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
