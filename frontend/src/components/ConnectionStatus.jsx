const labels = {
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
  unavailable: "Offline",
};

export function ConnectionStatus({ status }) {
  return (
    <span className={`connection-status ${status}`}>
      <span className="connection-dot" />
      {labels[status] ?? "Unknown"}
    </span>
  );
}
