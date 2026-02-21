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
