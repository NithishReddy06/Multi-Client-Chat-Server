import { LoginForm } from "./LoginForm.jsx";
import { RegisterForm } from "./RegisterForm.jsx";

export function AuthPage({
  mode,
  onModeChange,
  onSubmit,
  busy,
  error,
  notice,
}) {
  const isRegister = mode === "register";
  return (
    <main className="entry-page">
      <header className="entry-topbar">
        <a className="app-brand" href="#welcome" aria-label="Multi Client Chat">
          <span className="app-logo">m<span>.</span></span>
          <span className="app-name">relay<span> / chat</span></span>
        </a>
      </header>
      <section className="entry-card" aria-labelledby="welcome-title">
        <div className="entry-icon" aria-hidden="true">m<span>.</span></div>
        <p className="entry-eyebrow">PRIVATE, REAL-TIME CHAT</p>
        <h1 id="welcome-title">
          {isRegister ? "Join the conversation." : "Welcome back."}
        </h1>
        <p className="entry-copy">
          {isRegister
            ? "Create an account to join the general room. Your password is stored as a secure hash."
            : "Sign in to connect to the protected real-time chat."}
        </p>
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {isRegister ? (
          <RegisterForm
            onSubmit={onSubmit}
            onSwitch={() => onModeChange("login")}
            busy={busy}
            error={error}
          />
        ) : (
          <LoginForm
            onSubmit={onSubmit}
            onSwitch={() => onModeChange("register")}
            busy={busy}
            error={error}
          />
        )}
        <p className="entry-foot">
          HTTP-only session cookie · Passwords are never sent to other clients
        </p>
      </section>
      <p className="entry-footer">A networking project built with React, Express &amp; Socket.IO</p>
    </main>
  );
}
