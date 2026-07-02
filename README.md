# 🐍 Pyodide Python Compiler

An in-browser Python "compiler" component built with **React + Vite + TypeScript**
and [**Pyodide**](https://pyodide.org) (CPython compiled to WebAssembly). Write
Python, run it entirely client-side (no backend), feed it stdin, see stdout/stderr,
render matplotlib plots, and **step through execution line by line** with a live
variable inspector and call stack.

## Features

- **Code runner** — executes real CPython in the browser via Pyodide, in a Web
  Worker so runaway code never freezes the UI.
- **Code editor** — [CodeMirror 6](https://codemirror.net) with Python syntax
  highlighting.
- **Standard input** — pre-buffered stdin panel; `input()` reads one line at a
  time and raises a clean `EOFError` when exhausted.
- **Streamed output** — stdout/stderr appear incrementally, with stderr styled
  distinctly.
- **Execution trace visualization** — a `sys.settrace`-based instrumenter records
  each executed line; a step slider highlights the current source line and shows
  the live variables table and call stack (recursion included).
- **Third-party packages** — imports are auto-detected and any Pyodide-bundled
  package (`numpy`, `pandas`, `matplotlib`, …) is loaded on demand.
- **matplotlib** — the non-interactive Agg backend is forced and figures are
  captured as PNGs rendered inline in the output.
- **async / await** — top-level `await` is supported (compiled with
  `PyCF_ALLOW_TOP_LEVEL_AWAIT`), like a notebook cell.
- **Stop button** — interrupts runaway code (e.g. `while True: pass`) by
  terminating and respawning the worker.

## Getting started

```bash
npm install
npm run dev      # start the Vite dev server
```

Open the printed `localhost` URL. The **first load fetches ~10 MB of Pyodide
WASM from the CDN**, so give it a few seconds — the Run button shows
"Loading Python…" until the runtime is ready.

```bash
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## Usage examples

**Basic I/O**

```python
name = input()
count = int(input())
total = sum(range(count))
print(f"Hello {name}, the sum is {total}")
```
Provide input in the stdin panel (one value per line):
```
Ada
5
```

**numpy + matplotlib**

```python
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 2 * np.pi, 100)
plt.plot(x, np.sin(x), label="sin(x)")
plt.plot(x, np.cos(x), label="cos(x)")
plt.legend()
plt.show()
```

**async / await**

```python
import asyncio

async def fetch(n):
    await asyncio.sleep(0)
    return n * n

results = [await fetch(i) for i in range(5)]
print(results)
```

> ⚠️ `asyncio.run(...)` does **not** work — Pyodide already has a running event
> loop. Use top-level `await` instead (`await main()`).

## Architecture

```
Main thread (React)                    Web Worker (pyodideWorker.ts)
┌──────────────────────────┐            ┌──────────────────────────────┐
│ CodeEditor (CodeMirror)   │ ─RUN────► │ loadPyodide() from CDN         │
│ InputPanel                │           │ loadPackagesFromImports()      │
│ OutputPanel (text + PNGs) │ ◄STDOUT── │ patch input(), settrace()      │
│ TraceVisualizer           │ ◄TRACE─── │ exec / await user code         │
│ Controls (Run / Stop)     │ ◄FIGURE── │ capture matplotlib figures     │
└──────────────────────────┘ ◄DONE──── │ return trace JSON              │
                                         └──────────────────────────────┘
```

Pyodide runs in a dedicated Web Worker. The main thread and worker communicate
via typed messages (see `src/lib/workerProtocol.ts`). The Python instrumentation
(stdin patching, `sys.settrace` trace collection, matplotlib capture) lives in
`src/lib/tracerSource.ts` and is loaded into the interpreter once at startup.

### Project layout

```
src/
├── main.tsx                  # React entry (StrictMode omitted — avoids double Pyodide boot)
├── App.tsx                   # 3-pane layout + state wiring
├── lib/
│   ├── workerProtocol.ts     # message + TraceStep types shared across the worker boundary
│   └── tracerSource.ts       # Python instrumentation (as a source string)
├── workers/
│   └── pyodideWorker.ts      # loads Pyodide, runs code, streams output & figures
├── hooks/
│   └── usePyodideWorker.ts   # worker lifecycle, run/stop, output/trace/figure state
├── components/
│   ├── CodeEditor.tsx        # CodeMirror 6 + trace line-highlight decoration
│   ├── InputPanel.tsx        # stdin textarea
│   ├── OutputPanel.tsx       # stdout/stderr + inline figure images
│   ├── TraceVisualizer.tsx   # step slider, variables table, call stack
│   └── Controls.tsx          # Run / Stop / status
└── styles/app.css
```

## How it works — notes & trade-offs

- **Worker termination is the interrupt mechanism.** Without a
  `SharedArrayBuffer` interrupt buffer, the only reliable way to stop runaway
  user code is to kill and respawn the worker, which the Stop button does.
- **stdin is pre-buffered.** Truly interactive/blocking `input()` would require
  `SharedArrayBuffer` + `Atomics.wait` and cross-origin-isolation headers
  (`COOP`/`COEP`). The pre-buffered model avoids that complexity.
- **Trace payloads are capped** at 5,000 steps (`MAX_STEPS` in
  `tracerSource.ts`); exceeding it flags the trace as truncated so an infinite
  loop can't generate an unbounded payload.
- **Variable values are stringified** with `repr()` (truncated) so arbitrary
  Python objects never break trace serialization.
- **CDN version pin.** The Pyodide CDN `indexURL` in `pyodideWorker.ts` must
  match the `pyodide` version in `package.json`, or the JS loader and WASM
  payload mismatch and initialization fails.

## Tech stack

| Concern            | Choice                          |
| ------------------ | ------------------------------- |
| Framework / build  | React 18 + Vite 5 + TypeScript  |
| Python runtime     | Pyodide 0.26.4 (WASM, in Worker)|
| Editor             | CodeMirror 6                    |
