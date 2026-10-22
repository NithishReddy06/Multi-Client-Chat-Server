import { useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { MessageBubble } from "./MessageBubble.jsx";

export function MessageList({
  messages,
  currentUser,
  loading,
  connectionStatus,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="message-list" aria-live="polite">
      {loading ? (
        <div className="empty-state">
          <span className="spinner" aria-hidden="true" />
          <p>Connecting to the chat server…</p>
        </div>
      ) : messages.length ? (
        <div className="messages">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              ownMessage={message.username === currentUser}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="chat" size={22} />
          </div>
          <h2>No messages yet</h2>
          <p>
            {connectionStatus === "connected"
              ? "Your real-time connection is ready. Say hello to start the conversation."
              : "Connect to the server to prepare this conversation."}
          </p>
          <span className="empty-note">Messages are delivered live and are not saved.</span>
        </div>
      )}
    </div>
  );
}
