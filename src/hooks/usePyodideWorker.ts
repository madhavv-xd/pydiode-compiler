import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RequestMessage,
  ResponseMessage,
  TraceStep,
} from "../lib/workerProtocol";

export type Status = "loading" | "ready" | "running";

export interface OutputChunk {
  stream: "out" | "err";
  text: string;
}

export interface TraceResult {
  steps: TraceStep[];
  truncated: boolean;
}

function spawnWorker(): Worker {
  return new Worker(new URL("../workers/pyodideWorker.ts", import.meta.url), {
    type: "module",
  });
}

export function usePyodideWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [initError, setInitError] = useState<string | null>(null);
  const [output, setOutput] = useState<OutputChunk[]>([]);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [figures, setFigures] = useState<string[]>([]);

  // Wire up a worker instance and kick off Pyodide init.
  const attach = useCallback((worker: Worker) => {
    worker.onmessage = (e: MessageEvent<ResponseMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case "READY":
          setStatus("ready");
          break;
        case "INIT_ERROR":
          setInitError(msg.message);
          break;
        case "STDOUT":
          setOutput((prev) => [...prev, { stream: "out", text: msg.text }]);
          break;
        case "STDERR":
          setOutput((prev) => [...prev, { stream: "err", text: msg.text }]);
          break;
        case "TRACE":
          setTrace({ steps: msg.steps, truncated: msg.truncated });
          break;
        case "FIGURE":
          setFigures((prev) => [...prev, msg.png]);
          break;
        case "DONE":
          setStatus("ready");
          break;
      }
    };
    const init: RequestMessage = { type: "INIT" };
    worker.postMessage(init);
  }, []);

  useEffect(() => {
    const worker = spawnWorker();
    workerRef.current = worker;
    attach(worker);
    return () => worker.terminate();
  }, [attach]);

  const run = useCallback(
    (code: string, stdin: string) => {
      if (status !== "ready" || !workerRef.current) return;
      setOutput([]);
      setTrace(null);
      setFigures([]);
      setStatus("running");
      const msg: RequestMessage = { type: "RUN", code, stdin };
      workerRef.current.postMessage(msg);
    },
    [status],
  );

  // The only reliable way to interrupt runaway user code (without a
  // SharedArrayBuffer interrupt) is to kill the worker and start fresh.
  const stop = useCallback(() => {
    workerRef.current?.terminate();
    setStatus("loading");
    setOutput((prev) => [
      ...prev,
      { stream: "err", text: "\n[Execution stopped — restarting runtime…]\n" },
    ]);
    const worker = spawnWorker();
    workerRef.current = worker;
    attach(worker);
  }, [attach]);

  return { status, initError, output, trace, figures, run, stop };
}
