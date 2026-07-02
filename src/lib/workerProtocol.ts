// Message types exchanged between the main thread and the Pyodide worker.

/** A single captured execution step for the trace visualizer. */
export interface TraceStep {
  /** 1-based source line number being executed. */
  lineno: number;
  /** Name of the function this line belongs to ("<module>" at top level). */
  funcName: string;
  /** Local variables visible in the current frame at this step. */
  locals: Record<string, string>;
  /** Call stack (innermost last), each entry a function name. */
  stack: string[];
}

/** Messages sent from main thread -> worker. */
export type RequestMessage =
  | { type: "INIT" }
  | { type: "RUN"; code: string; stdin: string };

/** Messages sent from worker -> main thread. */
export type ResponseMessage =
  | { type: "READY" }
  | { type: "INIT_ERROR"; message: string }
  | { type: "STDOUT"; text: string }
  | { type: "STDERR"; text: string }
  | { type: "TRACE"; steps: TraceStep[]; truncated: boolean }
  | { type: "FIGURE"; png: string } // base64-encoded PNG (no data-URL prefix)
  | { type: "DONE"; error: string | null };
