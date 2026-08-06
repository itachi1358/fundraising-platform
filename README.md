# CareConnect

CareConnect is a secure fundraising platform for NIT Raipur students. Students can submit campaigns, discover verified campaigns, donate through Razorpay Test Mode, and track requests. Administrators review requests and manage the fundraising lifecycle.

## Features

- NIT Raipur email registration, bcrypt hashing, JWT HttpOnly-cookie sessions, protected routes, profile and logout controls.
- Searchable, sortable and paginated active campaigns; responsive campaign pages with progress, days left, sharing, and donation history.
- Campaign submission with optional Cloudinary banner/documents and pending-review workflow.
- Admin workspace for approval, rejection, editing, stopping, resuming, deleting, and fundraising analytics.
- Razorpay Standard Checkout in Test Mode, signed server-side verification, idempotent donation recording, and automatic campaign closure on goal completion.
- Professional approval, rejection, stopped, and goal-achieved emails when SMTP is configured.

## Run locally

Install the client and API packages:

```bash
npm install
npm --prefix server install
```

Copy `server/.env.example` to `server/.env`, then configure `MONGODB_URI` and a long random `JWT_SECRET` at minimum. Start the API and client in separate terminals:

```bash
npm run server
npm start
```

Open `http://localhost:3000`. The API health endpoint is `http://localhost:5000/api/health`.

## First administrator

Set `ADMIN_NAME`, `ADMIN_EMAIL`, and a 12+-character `ADMIN_PASSWORD` in `server/.env`, then run:

```bash
npm --prefix server run seed:admin
```

Sign in with that account to access `/admin`. Public registration always creates the `user` role.

## Optional integrations

- **Razorpay live payments:** Use Live Mode keys (`rzp_live_…`) and set `NODE_ENV=production`, `RAZORPAY_LIVE_ENABLED=true`, and `RAZORPAY_WEBHOOK_SECRET`. In the Razorpay Live Dashboard, register `https://your-api-domain/api/payments/razorpay-webhook` and subscribe to `payment.captured` and `payment.failed`; enable automatic payment capture. Test keys (`rzp_test_…`) are also supported. Mock payments are disabled unless explicitly enabled for local development.
- **Cloudinary:** Set the three Cloudinary variables to enable upload of banner images and supporting documents. URL-only banner images work without Cloudinary.
- **Email:** Set SMTP settings to send approval, rejection, stopped, and goal-reached notifications. Missing SMTP configuration only skips sending email; it never blocks an admin action.

## Deployment

Deploy `server/` as a Render Node web service with `npm start`, populate its environment variables, and set `CLIENT_ORIGIN` to the Vercel client URL. Deploy the repository root to Vercel; set `REACT_APP_API_URL` to `https://your-api.onrender.com/api`. The included `vercel.json` keeps React routes working on refresh.

## Verification

```bash
npm run build
node --check server/src/app.js
```
