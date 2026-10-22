function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function MessageBubble({ message, ownMessage }) {
  if (message.type === "system") {
    return (
      <p className="system-message">
        <span aria-hidden="true">·</span> {message.content}
      </p>
    );
  }

  return (
    <article className={`message-row ${ownMessage ? "own-message" : ""}`}>
      {!ownMessage && (
        <div className="avatar message-avatar">{initials(message.username)}</div>
      )}
      <div className="message-content">
        <div className="message-meta">
          <strong>{ownMessage ? "You" : message.username}</strong>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </div>
        <p className="message-bubble">{message.content}</p>
      </div>
      {ownMessage && (
        <div className="avatar message-avatar own-avatar">{initials(message.username)}</div>
      )}
    </article>
  );
}
