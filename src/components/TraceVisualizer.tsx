import { useEffect, useState } from "react";
import type { TraceResult } from "../hooks/usePyodideWorker";

interface Props {
  trace: TraceResult | null;
  onLineChange: (line: number | null) => void;
}

export function TraceVisualizer({ trace, onLineChange }: Props) {
  const [step, setStep] = useState(0);
  const steps = trace?.steps ?? [];
  const total = steps.length;

  // reset to the first step whenever a new trace arrives
  useEffect(() => {
    setStep(0);
  }, [trace]);

  // drive the editor line highlight from the current step
  useEffect(() => {
    if (total === 0) {
      onLineChange(null);
    } else {
      onLineChange(steps[Math.min(step, total - 1)].lineno);
    }
  }, [step, total, steps, onLineChange]);

  if (!trace) {
    return (
      <div className="trace-empty">
        Run your code to visualize its execution step by step.
      </div>
    );
  }

  if (total === 0) {
    return <div className="trace-empty">No executable lines were traced.</div>;
  }

  const current = steps[Math.min(step, total - 1)];
  const localEntries = Object.entries(current.locals);

  return (
    <div className="trace">
      <div className="trace-controls">
        <button onClick={() => setStep(0)} disabled={step === 0}>
          ⏮
        </button>
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ◀ Back
        </button>
        <button
          onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
          disabled={step >= total - 1}
        >
          Next ▶
        </button>
        <button onClick={() => setStep(total - 1)} disabled={step >= total - 1}>
          ⏭
        </button>
        <span className="trace-count">
          Step {step + 1} / {total} · line {current.lineno}
        </span>
      </div>

      <input
        className="trace-slider"
        type="range"
        min={0}
        max={total - 1}
        value={Math.min(step, total - 1)}
        onChange={(e) => setStep(Number(e.target.value))}
      />

      {trace.truncated && (
        <div className="trace-warning">
          ⚠ Trace truncated — execution exceeded the step limit.
        </div>
      )}

      <div className="trace-panels">
        <div className="trace-vars">
          <h4>Variables · {current.funcName}</h4>
          {localEntries.length === 0 ? (
            <div className="trace-none">(no local variables yet)</div>
          ) : (
            <table>
              <tbody>
                {localEntries.map(([name, val]) => (
                  <tr key={name}>
                    <td className="var-name">{name}</td>
                    <td className="var-val">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="trace-stack">
          <h4>Call stack</h4>
          <ol>
            {current.stack.map((fn, i) => (
              <li key={i} className={i === current.stack.length - 1 ? "stack-top" : ""}>
                {fn}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
