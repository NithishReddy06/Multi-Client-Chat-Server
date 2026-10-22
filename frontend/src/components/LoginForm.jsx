export function LoginForm({ onSubmit, onSwitch, busy, error }) {
  return (
    <form className="username-form auth-form" onSubmit={onSubmit}>
      <label htmlFor="login-username">Username</label>
      <input
        id="login-username"
        name="username"
        autoComplete="username"
        minLength={3}
        maxLength={24}
        pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,23}"
        title="Use 3–24 letters, numbers, dots, underscores, or hyphens."
        required
      />
      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        minLength={10}
        maxLength={72}
        required
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="auth-switch">
        New here? <button type="button" onClick={onSwitch}>Create an account</button>
      </p>
    </form>
  );
}
