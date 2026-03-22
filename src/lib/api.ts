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

export async function getOwnerData(pin: string) {
  return callFunction("owner-data", {
    method: "GET",
    headers: { "x-user-pin": pin },
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
