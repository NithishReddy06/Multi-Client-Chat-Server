import { ConnectionStatus } from "./ConnectionStatus.jsx";
import { Icon } from "./Icon.jsx";
import { OnlineUsers } from "./OnlineUsers.jsx";
import { RoomList } from "./RoomList.jsx";

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({ currentUser, onLeave, connectionStatus, users }) {
  return (
    <aside className="sidebar">
      <a className="app-brand" href="#chat" aria-label="Multi Client Chat">
        <span className="app-logo">m<span>.</span></span>
        <span className="app-name">relay<span> / chat</span></span>
      </a>

      <div className="sidebar-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">
        <a className="nav-item active" href="#chat" aria-current="page">
          <Icon name="chat" />
          <span>Messages</span>
          <span className="nav-indicator" />
        </a>
        <div className="nav-item disabled" aria-disabled="true">
          <Icon name="network" />
          <span>Network map</span>
          <span className="soon-label">SOON</span>
        </div>
      </nav>

      <div className="sidebar-divider" />
      <OnlineUsers users={users} currentUser={currentUser} />
      <RoomList />

      <div className="sidebar-bottom">
        <ConnectionStatus status={connectionStatus} />
        <div className="profile-card">
          <div className="avatar profile-avatar">{initials(currentUser) || "G"}</div>
          <div className="profile-copy">
            <strong>{currentUser}</strong>
            <span>Authenticated account</span>
          </div>
          <button
            className="icon-button leave-button"
            type="button"
            onClick={onLeave}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
