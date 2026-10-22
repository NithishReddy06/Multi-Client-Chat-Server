export function RegisterForm({ onSubmit, onSwitch, busy, error }) {
  return (
    <form className="username-form auth-form" onSubmit={onSubmit}>
      <label htmlFor="register-username">Username</label>
      <input
        id="register-username"
        name="username"
        autoComplete="username"
        minLength={3}
        maxLength={24}
        pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,23}"
        title="Use 3–24 letters, numbers, dots, underscores, or hyphens."
        required
      />
      <label htmlFor="register-password">Password</label>
      <input
        id="register-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        maxLength={72}
        required
      />
      <p className="auth-help">At least 10 characters; at most 72 UTF-8 bytes.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="auth-switch">
        Already registered? <button type="button" onClick={onSwitch}>Sign in</button>
      </p>
    </form>
  );
}
