import { useCallback, useEffect, useState } from "react";
import { AuthPage } from "./components/AuthPage.jsx";
import { ChatHeader } from "./components/ChatHeader.jsx";
import { MessageInput } from "./components/MessageInput.jsx";
import { MessageList } from "./components/MessageList.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { useChatSocket } from "./hooks/useChatSocket.js";
import {
  getCurrentSession,
  login,
  logout,
  register,
} from "./services/api.js";
import "./App.css";

function App() {
  const [auth, setAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentSession()
      .then((session) => {
        if (!active) return;
        setAuth(session.authenticated ? session : null);
      })
      .catch((error) => {
        if (active) setAuthError(error.message);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleExpiredSession = useCallback(() => {
    setAuth(null);
    setAuthMode("login");
    setAuthNotice("Your session ended. Please sign in again.");
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const credentials = {
      username: form.get("username"),
      password: form.get("password"),
    };
    try {
      const result = authMode === "register"
        ? await register(credentials)
        : await login(credentials);
      setAuth(result);
      setAuthError("");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await logout(auth.csrfToken);
      setAuth(null);
      setAuthMode("login");
      setAuthNotice("You have been signed out.");
      setAuthError("");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  if (authLoading) {
    return (
      <main className="entry-page">
        <p className="entry-copy" role="status">Checking your session…</p>
      </main>
    );
  }

  if (!auth) {
    return (
      <AuthPage
        mode={authMode}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError("");
          setAuthNotice("");
        }}
        onSubmit={submitAuth}
        busy={authBusy}
        error={authError}
        notice={authNotice}
      />
    );
  }

  return (
    <ChatWorkspace
      auth={auth}
      onLogout={handleLogout}
      onSessionExpired={handleExpiredSession}
      externalError={authError}
    />
  );
}

function ChatWorkspace({ auth, onLogout, onSessionExpired, externalError }) {
  const [messageError, setMessageError] = useState("");
  const {
    connectionStatus,
    messages,
    onlineUsers,
    messagesLoading,
    healthError,
    socketError,
    sendMessage,
  } = useChatSocket(auth.user, onSessionExpired);

  function handleSendMessage(message) {
    setMessageError("");
    return sendMessage(message);
  }

  return (
    <main className="chat-shell">
      <Sidebar
        currentUser={auth.user.username}
        onLeave={onLogout}
        connectionStatus={connectionStatus}
        users={onlineUsers}
      />
      <section className="conversation">
        <ChatHeader connectionStatus={connectionStatus} userCount={onlineUsers.length} />
        {(socketError || externalError) && (
          <div className="server-alert" role="status">
            <span className="alert-icon" aria-hidden="true">!</span>
            <div>
              <strong>Chat status</strong>
              <p>{externalError || socketError}</p>
            </div>
          </div>
        )}
        {healthError && !socketError && (
          <div className="server-alert database-alert" role="status">
            <span className="alert-icon" aria-hidden="true">i</span>
            <div>
              <strong>Database health check</strong>
              <p>{healthError} Chat history and message delivery require the database.</p>
            </div>
          </div>
        )}
        <MessageList
          messages={messages}
          currentUser={auth.user.username}
          loading={messagesLoading}
          connectionStatus={connectionStatus}
        />
        <MessageInput
          onSubmit={handleSendMessage}
          error={messageError}
          onError={setMessageError}
          disabled={connectionStatus !== "connected"}
        />
      </section>
    </main>
  );
}

export default App;
