const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callFunction(name: string, options: {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${name}`);
  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

export async function validatePin(pin: string) {
  return callFunction("validate-pin", { body: { pin } });
}

export async function getAdminProperties(adminPin: string) {
  return callFunction("admin-properties", {
    method: "GET",
    headers: { "x-admin-pin": adminPin },
  });
}

export async function createProperty(adminPin: string, data: Record<string, unknown>) {
  return callFunction("admin-properties", {
    method: "POST",
    headers: { "x-admin-pin": adminPin },
    body: data,
  });
}

export async function updateProperty(adminPin: string, id: string, data: Record<string, unknown>) {
  return callFunction("admin-properties", {
    method: "PUT",
    headers: { "x-admin-pin": adminPin },
    params: { id },
    body: data,
  });
}

export async function deleteProperty(adminPin: string, id: string) {
  return callFunction("admin-properties", {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
    params: { id },
  });
}

export async function fetchIcal(propertyId: string, pin: string) {
  return callFunction("fetch-ical", {
    body: { property_id: propertyId, owner_pin: pin },
  });
}

export async function getOwnerData(pin: string, propertyId?: string) {
  return callFunction("owner-data", {
    method: "GET",
    headers: { "x-user-pin": pin },
    params: propertyId ? { property_id: propertyId } : undefined,
  });
}

// Manual reservations (admin)
export async function getAdminReservations(adminPin: string, propertyId?: string) {
  return callFunction("admin-reservations", {
    method: "GET",
    headers: { "x-admin-pin": adminPin },
    params: propertyId ? { property_id: propertyId } : undefined,
  });
}

export async function createReservation(adminPin: string, data: Record<string, unknown>) {
  return callFunction("admin-reservations", {
    method: "POST",
    headers: { "x-admin-pin": adminPin },
    body: data,
  });
}

export async function updateReservation(adminPin: string, id: string, data: Record<string, unknown>) {
  return callFunction("admin-reservations", {
    method: "PUT",
    headers: { "x-admin-pin": adminPin },
    params: { id },
    body: data,
  });
}

export async function deleteReservation(adminPin: string, id: string) {
  return callFunction("admin-reservations", {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
    params: { id },
  });
}

export async function getAdminPendingIcal(adminPin: string) {
  return callFunction("admin-pending-ical", {
    method: "GET",
    headers: { "x-admin-pin": adminPin },
  });
}

// Cleaner/user operations
export async function getCleanerTasks(pin: string) {
  return callFunction("cleaner-operations", {
    method: "GET",
    headers: { "x-user-pin": pin },
  });
}

export async function getCleanerSchedule(pin: string, from: string, to: string) {
  return callFunction("cleaner-operations", {
    method: "GET",
    headers: { "x-user-pin": pin },
    params: { from, to },
  });
}

export async function markAsCleaned(pin: string, reservationId: string) {
  return callFunction("cleaner-operations", {
    method: "PUT",
    headers: { "x-user-pin": pin },
    body: { reservation_id: reservationId },
  });
}

// Admin mark cleaned
export async function adminMarkCleaned(adminPin: string, reservationId: string) {
  return callFunction("cleaner-operations", {
    method: "PUT",
    headers: { "x-admin-pin": adminPin },
    body: { reservation_id: reservationId },
  });
}

// Reset cleaning status to pending
export async function resetCleaningStatus(pin: string, reservationId: string) {
  return callFunction("cleaner-operations", {
    method: "PUT",
    headers: { "x-user-pin": pin },
    body: { reservation_id: reservationId, cleaning_status: "pending" },
  });
}

export async function adminResetCleaningStatus(adminPin: string, reservationId: string) {
  return callFunction("cleaner-operations", {
    method: "PUT",
    headers: { "x-admin-pin": adminPin },
    body: { reservation_id: reservationId, cleaning_status: "pending" },
  });
}

// Owner reservations / blocks
export async function createOwnerReservation(pin: string, data: Record<string, unknown>) {
  return callFunction("owner-reservations", {
    method: "POST",
    headers: { "x-user-pin": pin },
    body: data,
  });
}

// Admin timeline
export async function getAdminTimeline(adminPin: string, from: string, to: string) {
  return callFunction("admin-timeline", {
    method: "GET",
    headers: { "x-admin-pin": adminPin },
    params: { from, to },
  });
}

// Maintenance tickets
export async function getTickets(pin: string, role: "admin" | "user", propertyId?: string) {
  const header = role === "admin" ? "x-admin-pin" : "x-user-pin";
  return callFunction("maintenance-tickets", {
    method: "GET",
    headers: { [header]: pin },
    params: propertyId ? { property_id: propertyId } : undefined,
  });
}

export async function createTicket(pin: string, role: "admin" | "user", data: Record<string, unknown>) {
  const header = role === "admin" ? "x-admin-pin" : "x-user-pin";
  return callFunction("maintenance-tickets", {
    method: "POST",
    headers: { [header]: pin },
    body: data,
  });
}

export async function updateTicket(adminPin: string, id: string, data: Record<string, unknown>) {
  return callFunction("maintenance-tickets", {
    method: "PUT",
    headers: { "x-admin-pin": adminPin },
    params: { id },
    body: data,
  });
}

export async function deleteTicket(adminPin: string, id: string) {
  return callFunction("maintenance-tickets", {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
    params: { id },
  });
}

export async function uploadTicketMedia(file: File, ticketId: string): Promise<string> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const ext = file.name.split(".").pop() || "bin";
  const path = `${ticketId}/${Date.now()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/ticket-media/${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: file,
  });
  if (!res.ok) throw new Error("Upload failed");
  return `${SUPABASE_URL}/storage/v1/object/public/ticket-media/${path}`;
}

// Admin daily operations
export async function getDailyOperations(adminPin: string) {
  return callFunction("cleaner-operations", {
    method: "GET",
    headers: { "x-admin-pin": adminPin },
  });
}

// User management (admin)
export async function getAdminUsers(adminPin: string) {
  return callFunction("admin-users", {
    method: "GET",
    headers: { "x-admin-pin": adminPin },
  });
}

export async function createUser(adminPin: string, data: Record<string, unknown>) {
  return callFunction("admin-users", {
    method: "POST",
    headers: { "x-admin-pin": adminPin },
    body: data,
  });
}

export async function updateUser(adminPin: string, id: string, data: Record<string, unknown>) {
  return callFunction("admin-users", {
    method: "PUT",
    headers: { "x-admin-pin": adminPin },
    params: { id },
    body: data,
  });
}

export async function deleteUser(adminPin: string, id: string) {
  return callFunction("admin-users", {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
    params: { id },
  });
}
