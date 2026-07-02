import type { Status } from "../hooks/usePyodideWorker";

interface Props {
  status: Status;
  onRun: () => void;
  onStop: () => void;
}

export function Controls({ status, onRun, onStop }: Props) {
  return (
    <div className="controls">
      <button
        className="btn-run"
        onClick={onRun}
        disabled={status !== "ready"}
      >
        {status === "loading" ? "Loading Python…" : "▶ Run"}
      </button>
      <button
        className="btn-stop"
        onClick={onStop}
        disabled={status !== "running"}
      >
        ■ Stop
      </button>
      <span className={`status status-${status}`}>{statusLabel(status)}</span>
    </div>
  );
}

function statusLabel(status: Status): string {
  switch (status) {
    case "loading":
      return "Booting runtime…";
    case "ready":
      return "Ready";
    case "running":
      return "Running…";
  }
}
