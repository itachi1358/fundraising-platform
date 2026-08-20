# CareConnect — Tech Interview Preparation Guide

> **How to use this**: Every question below is answerable directly from the CareConnect codebase. Interviews reward candidates who can point to *real code they wrote* and explain *why*. For each question: (1) state the concept, (2) explain it like the interviewer is non-technical, (3) then ground it in the project with a specific file/line behavior.

---

## 0. Your 60-Second Project Pitch (Memorize This)

> "CareConnect is a full-stack crowdfunding platform for the NIT Raipur campus. A React single-page app talks to a REST API built with Express and MongoDB, with Redis for caching and rate limiting. The interesting engineering is around payments: we integrate Razorpay with two independent confirmation paths — a client-side signature callback and a signed server-side webhook — plus an idempotent donation state machine so no charge is ever credited twice. I also containerized the whole thing with Docker and reverse-proxied it through Nginx. The main challenges were payment integrity under concurrency, and making the app degrade gracefully when Redis or SMTP is down."

---

## 1. Project & Architecture Questions

### Q: Walk me through your project architecture.
**Answer**: It's a monorepo with a React 18 SPA frontend and an Express API backend. Nginx serves the built React files and reverse-proxies `/api/*` to the Express server on port 5000. The API talks to:
- **MongoDB** (via Mongoose) for Users, Campaigns, CampaignRequests, Donations
- **Redis** for response caching and distributed rate limiting
- **Razorpay** for payments (order creation + webhooks)
- **Cloudinary** for banner images and supporting documents
- **SMTP** (Nodemailer) for campaign-status emails

The request lifecycle: middleware stack → route → validation (Zod) → controller → service → model.

### Q: What's your favourite feature/engineering decision, and why?
**Answer**: The payment verification design. We have **two independent paths** to confirm a payment:
1. The Razorpay checkout fires a client callback with `payment_id` + `signature`, which we verify with HMAC.
2. Razorpay also POSTs a signed webhook with the raw body, which we verify with a separate webhook secret.

Both paths funnel into the same **idempotent state machine** (`pending → processing → success`). A donation is "claimed" atomically with `findOneAndUpdate({_id, status:'pending'}, {status:'processing'})`, so even if two requests arrive (browser callback + webhook) the campaign total is incremented exactly once. The `paymentId` also has a unique index so a successful gateway payment can't be replayed.

### Q: What would you improve if you had more time?
**Answer**: Honest answers are good here. Examples grounded in the project:
- Move from JS to TypeScript for contract safety.
- Add a proper job queue (e.g., BullMQ) for email sending instead of fire-and-forget promises.
- Add database transactions/MongoDB sessions so donation-settlement steps are fully atomic (though the current atomic pipeline already handles the critical path).
- Add rate-limited refresh tokens / logout revocation for JWT.
- Write more unit/integration tests (currently only a couple of React tests exist).

---

## 2. JavaScript / Node.js Questions

### Q: Explain the event loop, and why Node is good for an API like this.
**Answer**: Node is single-threaded with a non-blocking event loop. I/O (DB queries, HTTP calls to Razorpay, Redis reads) are async and don't block the thread. For CareConnect, almost everything is I/O-bound: hitting MongoDB, calling Razorpay, uploading to Cloudinary. The event loop stays free to handle many concurrent requests. The danger is CPU-bound work blocking the loop — that's why we do password hashing with bcrypt (which yields / is async) rather than a synchronous loop.

### Q: Why is the project ESM (`"type": "module"`)?
**Answer**: Modern Node ESM (`import`/`export`) gives static analysis, better tree-shaking for the frontend, and it's the forward-looking standard. The backend uses ESM throughout.

### Q: What's the difference between `async/await` and Promises?
**Answer**: `await` is syntactic sugar over Promises — it suspends the async function (not the thread) until a Promise settles, making async code read like synchronous code. In the project, controllers are `async` functions that `await` Mongoose queries and `try/catch` with `next(error)` to forward errors to the global error handler.

### Q: What does `void sendCampaignStatusEmail(...)` do? Why `void`?
**Answer**: `sendCampaignStatusEmail` is async but we explicitly don't want to block the HTTP response on email delivery (email is best-effort). `void` tells readers "fire and forget — we intentionally ignore this promise." The email function itself catches its own errors and never throws into the request path.

---

## 3. Express & Middleware Questions

### Q: Explain the middleware pattern in Express.
**Answer**: Express is a pipeline of functions. Each middleware receives `(req, res, next)` and either ends the response or calls `next()` to move to the next. Order matters. In `app.js` the order is: security headers → CORS → raw webhook → JSON body parser → cookie parser → NoSQL sanitizer → routes with per-group rate limiters → 404 → global error handler.

### Q: Why is the webhook route mounted BEFORE `express.json()`?
**Answer**: Razorpay signs the **exact raw bytes** of the request body. If we parse JSON first, Express reformats the body and the signature would no longer match. So the webhook route uses `express.raw({ type: 'application/json' })` and reads the raw buffer for HMAC verification, while all other routes use the JSON parser.

### Q: What is a global error handler and why do controllers use `next(error)`?
**Answer**: Controllers wrap logic in `try/catch` and call `next(error)`. The global error middleware in `app.js` receives it, logs it, maps known errors (like `MulterError` from uploads) and uses `error.statusCode` if present, and returns a safe message — for 5xx it returns a generic "unexpected server error" so we never leak internals.

### Q: What does `app.set('trust proxy', 1)` do?
**Answer**: When Express runs behind Nginx, `req.ip` shows the proxy's IP unless we tell Express to trust the `X-Forwarded-For` header that Nginx sets. This is critical for correct rate limiting (per real client IP) and logging.

---

## 4. MongoDB / Mongoose Questions

### Q: Describe your data model / schemas.
**Answer**: Four main collections:
- **User**: name, unique lowercased email, bcrypt-hashed password (`select:false`), role (`user|admin`), arrays of createdCampaigns and donations.
- **Campaign**: title, description, category, goalAmount, raisedAmount (denormalized counter), deadline, status, creator reference. Sensitive fields (`documents`, `upiId`, `bankDetails`, `adminRemarks`) use `select:false` so public queries never return them unless explicitly requested (admins get them via `.select('+...')`).
- **CampaignRequest**: requestedBy + embedded `campaignData` subdocument + status (pending/approved/rejected) + review audit fields. A request is approved by *creating* a Campaign.
- **Donation**: campaignId, donor, amount, currency, paymentProvider, orderId (unique sparse), paymentId (unique sparse), status (pending/processing/success/failed), paidAt.

### Q: Why is `raisedAmount` stored on the Campaign instead of computed from Donations?
**Answer**: It's a **denormalized / materialized counter**. Reading "how much has been raised" is a hot read on every campaign page and list view. Storing the running total makes reads O(1) instead of an aggregation over all donations. The cost is that every successful donation must atomically increment it — which we do in a single `findOneAndUpdate` with an aggregation pipeline.

### Q: Explain the atomic update pipeline used when a donation succeeds.
**Answer**: This single MongoDB operation does three things at once:
```js
Campaign.findOneAndUpdate(
  { _id, status: {$in: ['active','Active']}, $or: [deadline checks] },
  [
    { $set: { raisedAmount: { $round: [{ $add: [{ $ifNull: ['$raisedAmount',0] }, amount] }, 2] } } },
    { $set: { status: { $cond: [{ $gte: ['$raisedAmount', { $ifNull: ['$goalAmount', MAX] }] }, 'closed', '$status'] } } }
  ],
  { new: true }
)
```
Because the second `$set` reads the *updated* `raisedAmount` from the first `$set` (aggregation pipeline updates evaluate in order), we both add the donation **and** auto-close the campaign when the goal is reached, atomically, without a race condition between "increment" and "check goal".

### Q: How do you prevent NoSQL injection?
**Answer**: Two layers:
1. `express-mongo-sanitize` middleware strips `$` operators and `.` from incoming data, so a payload like `{"$gt": ""}` in a password field can't be turned into a query operator.
2. For free-text search we **escape regex metacharacters** with `escapedRegex()` before building `new RegExp(...)`, so a user can't inject regex like `.*` to bypass search.

### Q: What are Mongoose virtuals and `select:false`?
**Answer**:
- **Virtuals** are computed fields not stored in MongoDB. The Campaign exposes `currentAmount` as a virtual that reads/writes `raisedAmount`, so older clients using the name `currentAmount` keep working.
- **`select:false`** hides a field from queries by default. Password, payment signature, bank details, and supporting documents are `select:false`. They're only fetched with an explicit `.select('+field')` when authorized.

### Q: How do you automatically close campaigns?
**Answer**: Two complementary mechanisms:
1. A Mongoose `pre('validate')` hook on save: if `raisedAmount >= goalAmount`, set status to `closed`.
2. A static `closeEligibleCampaigns()` bulk sweep that `updateMany`s any active campaign that is past its deadline or fully funded. It's called at the start of list/detail queries (`refreshCampaignLifecycle`) so reads are resilient even if a payment update didn't run the lifecycle step.

---

## 5. Authentication & Security Questions (very likely)

### Q: Explain your authentication flow.
**Answer**: On register/login we hash the password with **bcrypt (12 rounds)**, then issue a **JWT** signed with `JWT_SECRET`. The token contains `sub` (user id) and `role`, expires in 7 days. We store the token in an **httpOnly cookie** (`careconnect_token`) rather than localStorage. On every protected request, the `requireAuth` middleware reads the cookie, verifies the JWT, loads the user from DB, and attaches them to `req.user`.

### Q: Why an httpOnly cookie instead of localStorage?
**Answer**: Security. An httpOnly cookie is **not readable by JavaScript**, so even if an attacker achieves XSS (injected script), they can't steal the token out of the cookie. localStorage is readable by any JS on the page, making XSS a token-theft bug. The trade-off is CSRF risk — mitigated here with `SameSite=Lax` (cookies not sent on cross-site requests) and same-origin API calls.

### Q: What is JWT and what's in your token?
**Answer**: JSON Web Token — a signed, self-contained token in three parts: header.payload.signature. Ours contains `sub` (user id) and `role`, signed with HS256 (`jsonwebtoken` default with the secret), expiry 7d. It's stateless: the server verifies the signature without looking anything up (though we do load the user from DB to make sure the account still exists).

### Q: What's the difference between authentication and authorization?
**Answer**: **Authentication** = who are you? (verifying the JWT in `requireAuth`). **Authorization** = what can you do? (checking `role === 'admin'` in `requireRole('admin')`). Every admin route uses both middlewares.

### Q: How do you protect passwords?
**Answer**: bcrypt with 12 salt rounds. bcrypt is deliberately slow (adaptive) to make brute-force attacks expensive, and each hash includes a random salt so identical passwords produce different hashes. We never store plaintext and never return the hash (field is `select:false`).

### Q: What is CSRF and how do you handle it?
**Answer**: Cross-Site Request Forgery — an attacker tricks the user's browser into making a state-changing request with their cookies. Because we use cookies for auth, we set `SameSite=Lax`, which prevents the cookie from being sent on cross-site requests. The `sameSite: 'lax'` is set in `setAuthCookie`, and CORS is locked to a single `CLIENT_ORIGIN` with `credentials: true`.

### Q: What is XSS and how does the project defend against it?
**Answer**: XSS = injecting executable script into a page. Defenses in this project:
- httpOnly cookies (token not JS-readable).
- React auto-escapes rendered text by default.
- Email templates escape all user content with an `escapeHtml()` helper before injecting into HTML (campaign titles, names, reviewer notes).
- `helmet()` sets security headers (`X-Frame-Options`, `nosniff`, etc.).

### Q: How is the admin role protected?
**Answer**: `AdminRoute` on the frontend hides the admin UI for non-admins, but the real protection is server-side: `router.use(requireAuth, requireRole('admin'))` on all `/api/admin/*` routes. The `role` claim comes from the signed JWT, so it can't be tampered with.

### Q: Why bcrypt with 12 rounds — is that slow?
**Answer**: Yes, intentionally. 12 rounds takes ~200-300ms per hash, which is fine for a login (one hash) but makes bulk brute-forcing impractical. It's a deliberate cost/security trade-off.

---

## 6. Payments & Webhooks Questions (the differentiator)

### Q: Explain the donation/payment flow.
**Answer**:
1. Client POSTs `/api/donations/order` with campaignId + amount.
2. Server checks the campaign is open, creates a **pending Donation** with a unique receipt, then calls Razorpay `orders.create`.
3. Server stores the `orderId` and returns the order + Razorpay `keyId` to the client.
4. Client opens Razorpay's hosted checkout with `order_id`.
5. On success, confirmation happens through **two independent paths** (callback + webhook) which both settle the donation and atomically increment the campaign.

### Q: Why two confirmation paths (callback AND webhook)? Isn't one enough?
**Answer**: Defense in depth. The **client callback** gives instant UX, but it's not trustworthy on its own — it comes from a browser that could be closed, lose connection, or be tampered with. The **webhook** comes directly from Razorpay's servers to our server, signed with a secret, so it's authoritative. Even if the user closes the tab right after paying, the webhook settles the donation. Both are safe because of idempotency — the first one to claim the donation wins, the other sees `success` and does nothing.

### Q: How do you verify the payment signature?
**Answer**: Razorpay computes `HMAC-SHA256(key_secret, "orderId|paymentId")`. We recompute the same HMAC in `verifyPaymentSignature` and compare using `crypto.timingSafeEqual`, which compares in **constant time** to prevent timing attacks. For the webhook, we compute `HMAC-SHA256(webhook_secret, rawBody)` and compare against the `x-razorpay-signature` header.

### Q: What is a webhook? Explain the endpoint.
**Answer**: A webhook is an HTTP callback — the provider (Razorpay) POSTs real-time events to your server. Ours is `POST /api/payments/razorpay-webhook`. Key details:
- Uses `express.raw` (not JSON parser) so we verify the signature over exact bytes.
- Has its own rate limiter.
- Handles `payment.failed` (mark donation failed) and `payment.captured` (settle donation).
- Always responds `200 {received:true}` for recognized-but-unactionable events to stop Razorpay retrying, and 4xx/5xx for real failures so Razorpay retries.

### Q: How do you prevent a payment from being counted twice? (Idempotency)
**Answer**: A three-layer defense:
1. **State machine**: donation goes `pending → processing → success`. The transition is done with an atomic `findOneAndUpdate({_id, status:'pending'})` — only one request can flip it from pending.
2. **Unique index on `paymentId`**: a successful gateway payment id can't be inserted into a second donation.
3. **Pre-checks**: if status is already `success`, the endpoint returns the already-confirmed result instead of re-processing.

### Q: What's a mock payment provider and why is it there?
**Answer**: `getPaymentProvider()` returns Razorpay when keys are configured, otherwise a **mock** provider so local development works before a Razorpay account exists. It's guarded: mock is only allowed when `NODE_ENV !== 'production'` and `ALLOW_MOCK_PAYMENTS=true`. The mock order id looks like `mock_order_<uuid>` and mock payment ids start with `mock_pay_`. This is a good example of **provider abstraction / strategy pattern** — controllers don't care which provider they're talking to.

### Q: What is the `receipt` field for?
**Answer**: A client-generated unique reference (e.g., `cc_<timestamp>_<userId>`). It ties a donation to the order and helps with reconciliation and looking up transactions.

### Q: What happens if the campaign is closed between order creation and payment?
**Answer**: The settlement uses a guarded `findOneAndUpdate` that only matches `status: 'active'` and non-expired deadlines. If the campaign no longer matches (e.g., closed/stopped), the update returns null and we **revert the donation to `pending`** for reconciliation rather than losing the money record. The API returns a 409 to the client.

---

## 7. Caching & Rate Limiting (Redis) Questions

### Q: Why Redis, and what do you use it for?
**Answer**: Two things:
1. **Response caching** — the campaign list (120s TTL) and single campaign (60s TTL) are cached in Redis. The `cache()` middleware intercepts `res.json`, stores successful responses, and serves cache hits with an `X-Cache: HIT/MISS` header. Keys include the query string so different filters/pages cache separately.
2. **Distributed rate limiting** — `rate-limit-redis` stores per-IP counters in Redis instead of memory, so limits are consistent across multiple API instances.

### Q: How do you keep the cache fresh after a mutation?
**Answer**: `invalidateCache('campaigns:*')` — after creating a campaign request we `KEYS campaigns:*` and `DEL` them, so the next read repopulates the cache. It's also safe if invalidation fails because entries have a TTL and expire naturally.

### Q: What if Redis is down?
**Answer**: **Graceful degradation** — the app is designed to keep working:
- The cache middleware catches Redis errors and just calls `next()` (no caching, but no crash).
- `connectRedis()` failure logs a warning and continues.
- Rate limiting falls back to the built-in **in-memory** store when Redis is unavailable.

### Q: Explain your rate limiting strategy.
**Answer**: Different tiers for different risk:
- Auth (login/signup): 20 per 15 min — prevents credential brute force.
- Payment (order/verify): 20 per 15 min — prevents donation abuse.
- Write (create/update): 30 per 15 min.
- Standard (reads): 150 per 15 min.
- Admin: 200 per 15 min.
- Health check: no limit (needed by monitors/load balancers).
Responses include a `429` message telling users to wait.

---

## 8. File Uploads Questions

### Q: How do you handle file uploads?
**Answer**: `multer` with **memory storage** (no disk), field limits (1 banner image, up to 5 documents, 6 files total), MIME allow-lists (JPEG/PNG/WebP for images, PDF for docs), and size limits (5 MB banner, 8 MB docs). After parsing, `uploadCampaignAssets` streams each buffer to **Cloudinary** in parallel, and only the returned HTTPS URLs are stored in the database — the DB never holds binary data.

### Q: Why Cloudinary instead of storing files in MongoDB or on disk?
**Answer**: Scalability and durability — MongoDB isn't good for large binaries, and the app runs in containers without persistent local disk. Cloudinary gives us CDN delivery, secure URLs, and automatic image optimizations. Storing only URLs keeps the DB small and queries fast.

### Q: How do you validate a file is actually safe?
**Answer**: We check the MIME type against allow-lists, enforce size caps, and limit counts. (An honest improvement answer: a real system would also inspect file magic bytes / content, scan for malware, and use private/expiring URLs for sensitive documents.)

---

## 9. React & Frontend Questions

### Q: Explain the React architecture.
**Answer**: A component-based SPA with `react-router-dom` v6. `AuthContext` (Context API) holds the global user state and exposes login/register/logout/updateProfile. Route guards (`ProtectedRoute`, `AdminRoute`) wrap protected layouts. All API calls go through a single axios instance (`client.js`) with `withCredentials: true` so the auth cookie travels automatically. Components are split into `Components/` (reusable UI like checkout, campaign card, forms), `pages/` (routes), `api/` (network), and `utils/` (helpers).

### Q: How does the auth state persist across page refreshes?
**Answer**: On app mount, `AuthProvider` calls `GET /auth/me`. The httpOnly cookie is sent automatically (axios `withCredentials`), the server verifies it and returns the user, and React rehydrates the context. Until that resolves, `loading` is true and the guards show a loading screen (preventing a flash of the login page).

### Q: What's the difference between state in React vs. the server?
**Answer**: React state (`useState`) is client-only UI state — e.g., which form fields are filled, whether the checkout modal is open. The server is the **source of truth** for persisted data (users, campaigns, donations). React "hydrates" from the server on load and re-fetches after mutations. Example: after `verifyDonation` succeeds, the parent updates the campaign's raised amount from the server response.

### Q: How did you handle the campaign list search?
**Answer**: The search input is **debounced** (280ms timer) to avoid firing a request on every keystroke, and each request is tracked with an `AbortController` so out-of-order responses don't clobber newer results. The server also supports server-side search via regex and pagination; the client falls back to client-side filtering/sorting if the API doesn't return pagination.

### Q: What is the Razorpay checkout integration on the client?
**Answer**: `DonationCheckout` lazily loads Razorpay's checkout script, calls `createDonationOrder`, then opens `new window.Razorpay({ key, order_id, handler })`. The `handler` receives `razorpay_payment_id` and `razorpay_signature`, which we send to `/donations/verify`. If the provider is mock, we show an in-app "confirm test donation" UI instead.

---

## 10. DevOps / Deployment Questions

### Q: Explain the Docker setup.
**Answer**: Two multi-stage Dockerfiles:
- **Frontend**: stage 1 builds the React app in `node:20-alpine`, stage 2 copies the static build into `nginx:1.27-alpine`.
- **Backend**: stage 1 installs deps, production stage prunes dev deps, installs `tini` (proper init/signal handling), runs as a **non-root user**, and copies only prod `node_modules` + `src`.
`docker-compose.yml` runs redis + mongo + api together with healthchecks and named volumes for data persistence.

### Q: Why a non-root user and `tini` in the backend container?
**Answer**: Best practice — running as non-root limits blast radius if the container is compromised. `tini` is a tiny init process that reaps zombie processes and forwards signals (SIGTERM → graceful shutdown) correctly to the Node process, which the default PID-1 doesn't do.

### Q: What does Nginx do in this project?
**Answer**:
1. **Serves** the static React build.
2. **SPA fallback**: `try_files $uri $uri/ /index.html` — any non-file route returns index.html so React Router handles it client-side.
3. **Reverse proxy** `/api/` to the Express container with forwarded headers and timeouts.
4. **Performance**: gzip compression, and `/static/` gets `expires 1y; immutable` because React outputs content-hashed filenames (safe to cache forever).
5. **Security headers** and blocking access to hidden files.

### Q: What is a reverse proxy and why do you need one?
**Answer**: A server that sits in front of backend servers and forwards client requests. Here it terminates HTTP, serves static content, and routes `/api/*` to Express. Benefits: central SSL termination, caching of static assets, adding security headers, and it hides the internal API container.

---

## 11. Concurrency, Race Conditions & System Design

### Q: What race conditions exist in a donation system and how did you solve them?
**Answer**: The biggest is **double crediting** — both the browser callback and the webhook (or a double-clicked verify) try to add the same donation to the campaign total. Solution: an atomic claim. `Donation.findOneAndUpdate({_id, status:'pending'}, {$set:{status:'processing'}})` guarantees exactly one process flips it from pending. Then the campaign increment is a single atomic pipeline. The unique `paymentId` index is the final backstop.

### Q: How would you scale this system? (System design)
**Answer**:
- **Read scaling**: The campaign list is read-heavy → Redis cache already reduces load; add a CDN for static + public campaign data.
- **Horizontal scaling**: Run multiple API containers behind a load balancer. Redis (shared) makes rate limiting and caching consistent across instances.
- **Database**: Shard by userId/campaignId; move cold donation history to cold storage; add read replicas for lists.
- **Async work**: Move emails (and document processing) to a queue (BullMQ + Redis) so heavy work doesn't hold request threads.
- **Payments**: Keep webhook handling idempotent (already done) so retries are safe under scale.

### Q: How is pagination implemented?
**Answer**: Server-side `skip`/`limit` with `countDocuments` for the total, returning `{ campaigns, pagination: { page, limit, total, pages } }`. Page/limit are validated and clamped (`limit` max 100 for donations, 50 for admin lists).

---

## 12. Behavioral & "Why" Questions

### Q: Tell me about a bug you fixed.
**Good answer**: "A duplicate donation could happen if the webhook and the callback raced. The fix was making the pending→processing transition an atomic conditional update instead of read-then-write. Before, we read the donation, checked the status, then updated — two requests could both pass the check. `findOneAndUpdate` with the status in the filter made only one winner possible."

### Q: Tell me about a time you had to make a trade-off.
**Good answer**: "Storing `raisedAmount` on the campaign denormalizes data (must keep it in sync) but makes reads O(1). We accepted the denormalization because list/detail reads vastly outnumber writes, and we made the update atomic to avoid drift."

### Q: How do you keep this project secure? (Broad)
**Answer**: Layers: helmet headers, CORS locked to one origin, NoSQL-injection sanitizer, regex escaping, Zod input validation, bcrypt hashing, httpOnly + SameSite cookies, JWT with expiry, RBAC middleware, constant-time signature verification, rate limiting on sensitive routes, `select:false` on sensitive fields, generic 5xx error messages, non-root containers, and HTTPS in production.

---

## 13. Quick-Fire "Must Know" Definitions

| Term | One-liner grounded in this project |
|---|---|
| JWT | Signed, self-contained token with `sub` + `role`, stored in an httpOnly cookie |
| Middleware | Function in the Express pipeline that handles/transforms the request (`requireAuth`, `validate`, `cache`) |
| Webhook | Server-to-server HTTP callback from Razorpay (`payment.captured`/`payment.failed`) |
| HMAC | Keyed hash used to sign/verify payloads; we use SHA-256 with `timingSafeEqual` |
| Idempotency | An operation that can run twice with the same effect (donation claim via status machine) |
| Denormalization | Storing derived data (`raisedAmount`) for fast reads |
| Rate limiting | Per-IP request caps with different tiers (auth 20, payment 20, write 30…) |
| TTL | Time-to-live — Redis cache entries expire (120s list, 60s single) |
| Reverse proxy | Nginx fronting the API: static serving, proxying, gzip, caching |
| Virtual field | Computed Mongoose field not stored in DB (`currentAmount` → `raisedAmount`) |
| Multi-stage build | Docker build with a builder stage + slim runtime stage |
| SPA fallback | Nginx `try_files ... /index.html` so React Router owns routes |
| CORS | Browser policy; API locked to `CLIENT_ORIGIN` with credentials |
| CSRF vs XSS | CSRF = forged request using your cookies (mitigated by SameSite); XSS = script injection (mitigated by httpOnly, React escaping) |

---

## 14. Suggested Self-Practice

1. **Whiteboard the payment flow** from `order` → `verify` → `webhook`, including the state machine. This is your strongest story.
2. **Trace a request** through `app.js` middleware order and explain *why* each piece is there.
3. **Explain security** as a layered story: headers → validation → sanitization → hashing → cookies → rate limits → RBAC → constant-time verification.
4. **Be ready to draw** the architecture diagram from `ARCHITECTURE.md`.
5. **Mock round**: have someone ask "What happens if Razorpay's webhook arrives before the client callback?" Answer: both settle identically; the first claim wins, the second returns the already-confirmed result.

---

*Prepared from the actual CareConnect codebase (see `ARCHITECTURE.md` for full file-by-file details).*
