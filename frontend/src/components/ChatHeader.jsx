import { ConnectionStatus } from "./ConnectionStatus.jsx";
import { Icon } from "./Icon.jsx";

export function ChatHeader({ connectionStatus, userCount }) {
  return (
    <header className="chat-header">
      <div className="room-heading">
        <span className="room-icon"><Icon name="hash" size={17} /></span>
        <div>
          <h1>general</h1>
          <p>Public chat room · {userCount} online</p>
        </div>
      </div>
      <div className="header-meta">
        <span className="preview-chip">PREVIEW</span>
        <ConnectionStatus status={connectionStatus} />
      </div>
    </header>
  );
}
