import { useState } from "react";
import { Icon } from "./Icon.jsx";

export function MessageInput({ onSubmit, onError, error, disabled = false }) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const message = value.trim();
    if (!message || disabled || pending) return;

    setPending(true);
    try {
      await onSubmit(message);
      setValue((currentValue) => (currentValue.trim() === message ? "" : currentValue));
    } catch (submitError) {
      onError?.(submitError.message);
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form className="composer-wrap" onSubmit={submit}>
      {error && <p className="composer-error" role="alert">{error}</p>}
      <div className={`composer ${disabled ? "composer-disabled" : ""}`}>
        <textarea
          aria-label="Write a message"
          placeholder={
            disabled
              ? "Connect to the chat server to send a message"
              : "Write a message…"
          }
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onError?.("");
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled || pending}
          maxLength={2000}
        />
        <div className="composer-actions">
          <span className="composer-hint">
            <kbd>ENTER</kbd> to send <span>·</span> <kbd>SHIFT + ENTER</kbd> for a new line
          </span>
          <button
            className="send-button"
            type="submit"
            disabled={disabled || pending || !value.trim()}
            aria-label="Send message"
            title={disabled ? "Message sending is not enabled yet" : "Send message"}
          >
            <Icon name="send" size={16} />
            <span>Send</span>
          </button>
        </div>
      </div>
    </form>
  );
}
