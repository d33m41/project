const CONFIG = {
  // Празен низ = заявките отиват към същия origin, на който е зареден сайтът (relative paths).
  // За локален бекенд: "http://localhost:8000", "http://127.0.0.1:3000" и т.н.
  API_BASE_URL: "",
};

// Токенът се пази САМО в паметта (не localStorage/sessionStorage — не са надеждни тук).
// При презареждане на страницата ще се изгуби и потребителят ще трябва да влезе пак,
// освен ако backend-ът ползва httpOnly cookie сесия (виж бележката при login()).
let authToken = null;

/* основна заявка */
async function request(method, path, body, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(CONFIG.API_BASE_URL + path, {
    method,
    headers,
    credentials: opts.useCookies ? "include" : "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    // Очаквай бекендът да връща нещо като { "error": "...", "details": {...} }
    const message = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

const Api = {

  /* Auth */

  // POST /register — backend-ът трябва сам да наложи role='student' за този route.
  async register({ name, email, password }) {
    return request("POST", "/register", { name, email, password });
  },

  // POST /login — пази токена в паметта. Ако бекендът връща { token } или { access_token }, провери ключа.
  async login({ email, password }) {
    const data = await request("POST", "/login", { email, password });
    authToken = data.token || data.access_token;
    return data; // обикновено { token, user: {...} }
  },

  // POST /logout
  async logout() {
    try { await request("POST", "/logout"); } finally { authToken = null; }
  },

  /* Профил */

  async getMe() {
    return request("GET", "/users/me");
  },
  async updateMe(patch) {
    return request("PUT", "/users/me", patch);
  },

  /* Events */

  // GET /events — студент вижда само PUBLISHED, организатор вижда и своите DRAFT.
  // Поддръжка на query филтри (search/date) ако бекендът ги поддържа:
  async listEvents({ search, date } = {}) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (date) params.set("date", date);
    const qs = params.toString() ? `?${params}` : "";
    return request("GET", `/events${qs}`);
  },

  async getEvent(id) {
    return request("GET", `/events/${id}`);
  },

  // POST /events — организатор създава DRAFT.
  async createEvent({ title, description, startsAt, endsAt, capacity, location }) {
    return request("POST", "/events", {
      title, description,
      starts_at: startsAt, ends_at: endsAt,
      capacity, location,
    });
  },

  // PUT /events/{id} — само докато е DRAFT (бекендът налага правилото).
  async updateEvent(id, patch) {
    return request("PUT", `/events/${id}`, patch);
  },

  // POST /events/{id}/publish
  async publishEvent(id) {
    return request("POST", `/events/${id}/publish`);
  },

  // POST /events/{id}/cancel
  async cancelEvent(id) {
    return request("POST", `/events/${id}/cancel`);
  },

  /* Регистрации */

  // POST /events/{id}/registrations — връща CONFIRMED или WAITLISTED (+ позиция).
  async registerForEvent(eventId) {
    return request("POST", `/events/${eventId}/registrations`);
  },

  // DELETE /registrations/{id} — собствена регистрация; може да промотира следващия чакащ.
  async cancelRegistration(registrationId) {
    return request("DELETE", `/registrations/${registrationId}`);
  },

  // GET /registrations/me — само собствените регистрации на студента.
  async myRegistrations() {
    return request("GET", "/registrations/me");
  },

  // GET /events/{id}/registrations — организатор: само за собствени събития (403 иначе).
  async eventRegistrations(eventId) {
    return request("GET", `/events/${eventId}/registrations`);
  },

  // GET /events/{id}/waitlist — организатор, подреден FIFO списък.
  async eventWaitlist(eventId) {
    return request("GET", `/events/${eventId}/waitlist`);
  },

  /* Notification jobs (optional/debug) */

  async getNotificationJob(id) {
    return request("GET", `/notificationjobs/${id}`);
  },
  async listNotificationJobs({ eventId } = {}) {
    const qs = eventId ? `?event_id=${eventId}` : "";
    return request("GET", `/notification-jobs${qs}`);
  },
};
