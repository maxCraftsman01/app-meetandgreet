const SESSION_KEY = "hams_session";

interface Session {
  role: "admin" | "owner" | "cleaner";
  pin: string;
  properties?: Array<{ id: string; name: string; owner_name: string }>;
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
