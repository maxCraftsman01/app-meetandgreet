const SESSION_KEY = "hams_session";

export interface PropertyAccess {
  id: string;
  name: string;
  owner_name: string;
  can_view_finance: boolean;
  can_view_cleaning: boolean;
  can_mark_cleaned: boolean;
}

export interface Session {
  role: "admin" | "user";
  pin: string;
  user_id?: string;
  user_name?: string;
  properties?: PropertyAccess[];
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
