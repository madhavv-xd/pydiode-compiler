/// <reference lib="webworker" />
import { loadPyodide, type PyodideInterface } from "pyodide";
import { TRACER_SOURCE } from "../lib/tracerSource";
import type {
  RequestMessage,
  ResponseMessage,
  TraceStep,
} from "../lib/workerProtocol";

// The CDN version MUST match the installed `pyodide` npm package version,
// or the JS loader and the wasm payload will mismatch and fail to init.
const PYODIDE_VERSION = "0.26.4";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodide: PyodideInterface | null = null;

function post(msg: ResponseMessage) {
  self.postMessage(msg);
}

async function init() {
  try {
    pyodide = await loadPyodide({ indexURL: INDEX_URL });
    // stream stdout/stderr to the UI as it is produced. `batched` fires once
    // per complete line with the trailing newline stripped, so re-add it.
    pyodide.setStdout({ batched: (text: string) => post({ type: "STDOUT", text: text + "\n" }) });
    pyodide.setStderr({ batched: (text: string) => post({ type: "STDERR", text: text + "\n" }) });
    // define run_user_code(...) once
    await pyodide.runPythonAsync(TRACER_SOURCE);
    post({ type: "READY" });
  } catch (err) {
    post({ type: "INIT_ERROR", message: String(err) });
  }
}

async function run(code: string, stdin: string) {
  if (!pyodide) {
    post({ type: "DONE", error: "Pyodide is not ready yet." });
    return;
  }
  try {
    // Auto-load any Pyodide-bundled packages the code imports (numpy, pandas,
    // etc.). Without this, `import numpy` fails — nothing is preloaded.
    try {
      await pyodide.loadPackagesFromImports(code, {
        messageCallback: (text: string) => post({ type: "STDOUT", text: text + "\n" }),
      });
    } catch (loadErr) {
      // A package that isn't in Pyodide's distribution (or a network failure)
      // shouldn't abort the run — report it and let the import raise normally.
      post({ type: "STDERR", text: `Package load warning: ${String(loadErr)}\n` });
    }

    const runner = pyodide.globals.get("run_user_code");
    // run_user_code is async (to support top-level await in user code), so
    // calling it returns a coroutine that must be awaited.
    const resultJson: string = await runner(code, stdin);
    runner.destroy?.();
    const result = JSON.parse(resultJson) as {
      steps: TraceStep[];
      truncated: boolean;
      error: string | null;
      figures: string[];
    };
    post({ type: "TRACE", steps: result.steps, truncated: result.truncated });
    for (const png of result.figures) {
      post({ type: "FIGURE", png });
    }
    if (result.error) {
      post({ type: "STDERR", text: result.error });
    }
    post({ type: "DONE", error: result.error });
  } catch (err) {
    // A failure here (not a Python-level exception) means something broke in
    // the bridge itself; surface it rather than silently hanging.
    post({ type: "STDERR", text: String(err) });
    post({ type: "DONE", error: String(err) });
  }
}

self.onmessage = (e: MessageEvent<RequestMessage>) => {
  const msg = e.data;
  if (msg.type === "INIT") {
    void init();
  } else if (msg.type === "RUN") {
    void run(msg.code, msg.stdin);
  }
};
