// Python source (as a string) loaded once into the Pyodide interpreter.
// It defines `run_user_code(user_code, stdin_text)` which:
//   * patches builtins.input() to read from the supplied stdin buffer,
//   * installs a sys.settrace hook that records one entry per executed line
//     of the *user's* code (library frames are ignored),
//   * caps the number of captured steps to keep payloads bounded,
//   * executes the user code and returns the trace as a JSON string.
//
// stdout/stderr are NOT handled here — the worker wires those up via
// pyodide.setStdout/setStderr so output can stream to the UI incrementally.

export const TRACER_SOURCE = String.raw`
import sys
import json
import builtins
import ast
import inspect

USER_FILENAME = "<user_code>"
MAX_STEPS = 5000
MAX_REPR_LEN = 200

def _safe_repr(value):
    try:
        r = repr(value)
    except Exception:
        try:
            r = str(value)
        except Exception:
            r = "<unrepresentable>"
    if len(r) > MAX_REPR_LEN:
        r = r[:MAX_REPR_LEN] + "…"
    return r

def _snapshot_locals(frame_locals):
    out = {}
    for name, value in frame_locals.items():
        if name.startswith("__") and name.endswith("__"):
            continue
        # Skip modules, functions and classes — not useful in a values table.
        if callable(value) or isinstance(value, type(sys)):
            continue
        out[name] = _safe_repr(value)
    return out

def _setup_matplotlib(figures):
    # Pyodide has no interactive GUI backend, so force the non-interactive Agg
    # backend and redirect plt.show() to capture figures as base64 PNGs.
    try:
        import matplotlib
        matplotlib.use("AGG")
        import matplotlib.pyplot as plt
    except ImportError:
        return  # matplotlib not used / not loaded — nothing to do

    def _capture(*args, **kwargs):
        _collect_figures(figures)

    plt.show = _capture

def _collect_figures(figures):
    try:
        import matplotlib.pyplot as plt
        import io, base64
    except ImportError:
        return
    for num in plt.get_fignums():
        fig = plt.figure(num)
        buf = io.BytesIO()
        try:
            fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
        except Exception:
            continue
        figures.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    plt.close("all")

async def run_user_code(user_code, stdin_text):
    # --- stdin: pre-buffered input(), one value per line ---
    lines = stdin_text.split("\n") if stdin_text else []
    # A trailing newline produces a spurious empty final element; drop it.
    if lines and lines[-1] == "":
        lines.pop()
    input_iter = iter(lines)

    def patched_input(prompt=""):
        if prompt:
            print(prompt, end="")
        try:
            return next(input_iter)
        except StopIteration:
            raise EOFError("EOF when reading a line")

    original_input = builtins.input
    builtins.input = patched_input

    steps = []
    truncated = [False]

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != USER_FILENAME:
            return None  # don't descend into library code
        if event == "line" or event == "call":
            if len(steps) >= MAX_STEPS:
                truncated[0] = True
                return None
            # Build the call stack (function names, outermost first).
            stack = []
            f = frame
            while f is not None:
                if f.f_code.co_filename == USER_FILENAME:
                    stack.append(f.f_code.co_name)
                f = f.f_back
            stack.reverse()
            steps.append({
                "lineno": frame.f_lineno,
                "funcName": frame.f_code.co_name,
                "locals": _snapshot_locals(frame.f_locals),
                "stack": stack,
            })
        return tracer

    figures = []
    _setup_matplotlib(figures)

    error = None
    user_globals = {"__name__": "__main__", "__file__": USER_FILENAME}
    try:
        # compile() is inside the try so syntax errors are reported as a
        # normal error result rather than crashing the worker bridge.
        # PyCF_ALLOW_TOP_LEVEL_AWAIT lets user code use top-level await
        # (and async for / async with) directly, like a notebook cell.
        code_obj = compile(
            user_code, USER_FILENAME, "exec",
            flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT,
        )
        sys.settrace(tracer)
        if code_obj.co_flags & inspect.CO_COROUTINE:
            # Awaitable module: eval returns the coroutine; await it.
            coro = eval(code_obj, user_globals)
            if coro is not None:
                await coro
        else:
            exec(code_obj, user_globals)
    except SystemExit:
        pass
    except BaseException as exc:
        import traceback
        error = "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        )
    finally:
        sys.settrace(None)
        builtins.input = original_input

    # Capture any figures the user created but never explicitly show()-ed.
    _collect_figures(figures)

    return json.dumps({
        "steps": steps,
        "truncated": truncated[0],
        "error": error,
        "figures": figures,
    })
`;
