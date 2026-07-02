import { useEffect, useRef } from "react";
import type { OutputChunk } from "../hooks/usePyodideWorker";

interface Props {
  output: OutputChunk[];
  figures: string[];
}

export function OutputPanel({ output, figures }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [output, figures]);

  const isEmpty = output.length === 0 && figures.length === 0;

  return (
    <div className="output-panel">
      {isEmpty ? (
        <span className="output-empty">Program output will appear here.</span>
      ) : (
        output.map((chunk, i) => (
          <span
            key={i}
            className={chunk.stream === "err" ? "output-err" : "output-out"}
          >
            {chunk.text}
          </span>
        ))
      )}
      {figures.map((png, i) => (
        <img
          key={`fig-${i}`}
          className="output-figure"
          src={`data:image/png;base64,${png}`}
          alt={`Figure ${i + 1}`}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
