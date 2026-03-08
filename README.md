# Home Harmony

Home Harmony is a family operations app for:
- weekly meal planning
- recipe library + imports
- merged grocery lists with quantity rollups
- chores and household task tracking
- personal nutrition dashboards

## Local Development

```sh
npm install
npm run dev
```

Landing page:
- `http://127.0.0.1:4173/`

App dashboard:
- `http://127.0.0.1:4173/app`

## Auth + Billing Setup (Supabase + Stripe)

Required Supabase Edge Function secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Apply DB migration:

```sh
supabase db push
```

Deploy Edge Functions:

```sh
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
```

Set function secrets:

```sh
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_or_test_... \
  STRIPE_PRICE_ID=price_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  SUPABASE_SERVICE_ROLE_KEY=...
```

Create Stripe webhook endpoint for:
- `POST https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`

Listen to events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

App flow:
- `/signin` for account creation/login
- `/billing` for checkout and billing portal
- subscribed users can access `/app`, `/meals`, `/recipes`, `/grocery`, `/chores`, `/tasks`, `/me`, `/wife`

## Build

```sh
npm run build
```

## Apple Calendar Integration (v1: subscribed ICS feed)

Home Harmony is the source of truth for calendar events. Apple Calendar is a read-only subscribed view.

### Architecture

- Data source: `public.calendar_events`
- Feed token table: `public.calendar_feed_tokens`
- Edge function: `apple-calendar-feed`
  - Auth actions:
    - `action: "get_urls"` returns user-scoped subscribed feed URLs
    - `action: "regenerate_token"` rotates token and invalidates old URLs
  - Public feed route:
    - `GET /functions/v1/apple-calendar-feed/calendar/<token>/<layer>.ics`
- Supported layer feeds:
  - `all`, `family`, `meals`, `kids`, `chores`, `deliveries`

### Subscription flow

1. User opens `/calendar/connect-apple`.
2. User copies a private feed URL.
3. User subscribes in Apple Calendar:
   - iPhone/iPad: `Settings > Calendar > Accounts > Add Account > Other > Add Subscribed Calendar`
   - Mac Calendar: `File > New Calendar Subscription`
4. User continues editing events in Home Harmony only.
5. Apple refreshes the subscribed feed on Apple’s schedule.

### Local testing

1. Run migrations and serve edge functions:

```sh
supabase db push
supabase functions serve apple-calendar-feed --no-verify-jwt
```

2. Start frontend:

```sh
npm run dev
```

3. In app:
   - create/edit calendar events in Home Harmony
   - open `/calendar/connect-apple`
   - copy the `all` feed URL and open it in a browser to verify ICS content
4. Regenerate token and verify old URL returns not found.
5. Confirm layer URLs only include matching categories (for example `.../meals.ics`).
