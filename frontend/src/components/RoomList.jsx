import { Icon } from "./Icon.jsx";

export function RoomList() {
  return (
    <section className="side-section room-section" aria-labelledby="rooms-heading">
      <div className="section-title-row">
        <h2 id="rooms-heading">Your rooms</h2>
      </div>
      <div className="room-list-empty">
        <Icon name="hash" size={16} />
        <span>general</span>
        <span className="room-active-dot" aria-label="active room" />
      </div>
    </section>
  );
}
