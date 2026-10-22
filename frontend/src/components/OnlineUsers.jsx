function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function OnlineUsers({ users, currentUser }) {
  return (
    <section className="side-section" aria-labelledby="online-users-heading">
      <div className="section-title-row">
        <h2 id="online-users-heading">Online now</h2>
        <span className="count-pill">{users.length}</span>
      </div>
      {users.length ? (
        <ul className="online-user-list">
          {users.map((user) => (
            <li className="online-user" key={user.username}>
              <span className="avatar online-avatar">{initials(user.username)}</span>
              <span className="online-name">
                {user.username}
                {user.username === currentUser && <small> (you)</small>}
              </span>
              <span className="online-presence" aria-label="online" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="sidebar-empty">
          <span className="presence-mark" aria-hidden="true" />
          <p>Join the chat to see who's online.</p>
        </div>
      )}
    </section>
  );
}
