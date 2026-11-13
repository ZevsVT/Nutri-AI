import { useState } from "react";
import { login, logout, register, type AuthUser } from "../../services/authService";
import { Button } from "./Button";
import { Modal } from "./Modal";

export function AccountModal({ user, onSession, onClose }: {
  user: AuthUser | null;
  onSession: (user: AuthUser | null) => void;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    try {
      if (user) {
        await logout();
        onSession(null);
      } else {
        const input = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
        const result = creating ? await register({ ...input, name: String(form.get("name") ?? "") }) : await login(input);
        onSession(result.user);
      }
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update your session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={() => { if (!busy) onClose(); }} title={user ? "Account" : creating ? "Create an account" : "Sign in"}>
      <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
        {user ? <p>Signed in as {user.email}</p> : (
          <>
            {creating && <label className="form-label">Name<input className="form-input" name="name" autoComplete="name" maxLength={120} required /></label>}
            <label className="form-label">Email<input className="form-input" name="email" type="email" autoComplete="email" required /></label>
            <label className="form-label">Password<input className="form-input" name="password" type="password" autoComplete={creating ? "new-password" : "current-password"} required /></label>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <Button type="submit" loading={busy} variant="primary">{user ? "Sign out" : creating ? "Create account" : "Sign in"}</Button>
        {!user && <Button disabled={busy} onClick={() => { setCreating(!creating); setError(""); }}>
          {creating ? "Use an existing account" : "Create an account"}
        </Button>}
      </form>
    </Modal>
  );
}
