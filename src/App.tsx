import { useCallback, useState } from "react";
import { usePyodideWorker } from "./hooks/usePyodideWorker";
import { CodeEditor } from "./components/CodeEditor";
import { InputPanel } from "./components/InputPanel";
import { OutputPanel } from "./components/OutputPanel";
import { TraceVisualizer } from "./components/TraceVisualizer";
import { Controls } from "./components/Controls";
import "./styles/app.css";

const EXAMPLE = `name = input()
count = int(input())

total = 0
for i in range(count):
    total = total + i
    print(f"step {i}: total is {total}")

print(f"Hello {name}, the sum is {total}")
`;

export default function App() {
  const { status, initError, output, trace, figures, run, stop } =
    usePyodideWorker();
  const [code, setCode] = useState(EXAMPLE);
  const [stdin, setStdin] = useState("Ada\n5\n");
  const [highlightLine, setHighlightLine] = useState<number | null>(null);

  const onLineChange = useCallback((line: number | null) => {
    setHighlightLine(line);
  }, []);

  const running = status === "running";

  return (
    <div className="app">
      <header className="app-header">
        <h1>🐍 Pyodide Python Compiler</h1>
        <Controls status={status} onRun={() => run(code, stdin)} onStop={stop} />
      </header>

      {initError && (
        <div className="init-error">Failed to load Pyodide: {initError}</div>
      )}

      <main className="app-grid">
        <section className="pane pane-editor">
          <h3>Code</h3>
          <CodeEditor
            value={code}
            onChange={setCode}
            highlightLine={highlightLine}
            readOnly={running}
          />
        </section>

        <section className="pane pane-io">
          <h3>Input (stdin)</h3>
          <InputPanel value={stdin} onChange={setStdin} />
          <h3>Output</h3>
          <OutputPanel output={output} figures={figures} />
        </section>

        <section className="pane pane-trace">
          <h3>Execution trace</h3>
          <TraceVisualizer trace={trace} onLineChange={onLineChange} />
        </section>
      </main>
    </div>
  );
}
