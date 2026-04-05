# Postmark + Gmail Forwarding Setup Guide

End-to-end guide for setting up the email-to-transaction pipeline: Gmail → Postmark → kharcha-backend → mobile app.

## Overview

```text
Gmail (bank alerts)
  │
  │ auto-forwards to sync+token@mail.yourdomain.com
  ▼
Postmark (inbound email service)
  │
  │ POST /webhook/email/:token
  ▼
kharcha-backend (Railway)
  │
  │ parses bank email → stores transaction
  ▼
Mobile App (GET /sync)
  │
  │ pulls new transactions into local SQLite
  ▼
Done — transaction appears in Kharcha
```

## Prerequisites

- A domain you own (e.g. `thechetanjain.com`)
- Access to your domain's DNS settings (Vercel, Hostinger, Cloudflare, etc.)
- A Postmark account (free tier: 100 inbound emails/month)
- kharcha-backend deployed on Railway
- Gmail account receiving bank transaction alerts

## Step 1: Create Postmark Account & Server

1. Sign up at [postmarkapp.com](https://postmarkapp.com)
2. Create a new **Server** (e.g. "Kharcha")
3. Go to **Message Streams** → you'll see a "Default Inbound Stream" already created
4. Note your **Server API Token** from the API Tokens tab (not needed for inbound, but useful for testing)

## Step 2: Add MX Record for Your Domain

You need an MX record so emails sent to your domain get routed to Postmark's servers.

**Use a subdomain** (e.g. `mail.yourdomain.com`) to avoid breaking existing email on your root domain.

### Find Your DNS Provider

Your DNS is managed wherever your **nameservers** point to. Check with:

```bash
dig NS yourdomain.com
```

Common setups:
- Nameservers → Vercel (`ns1.vercel-dns.com`) → edit DNS in Vercel dashboard
- Nameservers → Cloudflare → edit DNS in Cloudflare dashboard
- Nameservers → Hostinger → edit DNS in Hostinger hPanel

### Add the MX Record

| Field    | Value                      |
|----------|----------------------------|
| Type     | MX                         |
| Name     | `mail`                     |
| Value    | `inbound.postmarkapp.com`  |
| Priority | `10`                       |
| TTL      | `60` (or default)          |

### Verify DNS Propagation

```bash
dig MX mail.yourdomain.com
```

Expected output:
```
mail.yourdomain.com.  60  IN  MX  10  inbound.postmarkapp.com.
```

If it doesn't show up, wait a few minutes and try again. DNS propagation is usually instant but can take up to 30 minutes.

## Step 3: Configure Postmark Inbound Stream

1. Go to Postmark → your Server → **Message Streams** → **Default Inbound Stream**
2. Click **Settings**
3. Set **Inbound domain**: `mail.yourdomain.com`
4. Set **Inbound webhook URL**: `https://your-railway-url.railway.app/webhook/email/<POSTMARK_WEBHOOK_TOKEN>`
   - Replace `<POSTMARK_WEBHOOK_TOKEN>` with the value from your Railway env vars
   - This secret path segment authenticates the webhook — Postmark doesn't send auth headers
5. Click **Save changes** on both sections
6. Click **Check** next to the webhook URL to verify Postmark can reach your backend

## Step 4: Set Environment Variables on Railway

On your kharcha-backend Railway service, set:

| Variable                 | Value                        |
|--------------------------|------------------------------|
| `EMAIL_DOMAIN`           | `mail.yourdomain.com`        |
| `POSTMARK_WEBHOOK_TOKEN` | Your chosen secret token     |

The `EMAIL_DOMAIN` controls what forwarding emails look like when devices register (e.g. `sync+abc123@mail.yourdomain.com`).

## Step 5: Register Device in the App

1. Open Kharcha → Profile → Device Sync
2. Tap **Register Device**
3. You'll get a forwarding email like `sync+abc123@mail.yourdomain.com`
4. Tap to copy it

## Step 6: Set Up Gmail Forwarding

1. Open Gmail → Settings (gear icon) → **See all settings**
2. Go to **Forwarding and POP/IMAP** tab
3. Click **Add a forwarding address**
4. Paste the forwarding email from Step 5
5. Gmail sends a confirmation email to that address
6. The confirmation email flows through: Gmail → Postmark → your webhook
7. Check Railway logs — you should see the webhook receive it (it won't parse as a bank transaction, but it confirms the pipeline works)
8. Go to Postmark → Activity → find the confirmation email → get the confirmation link from the email body
9. Open the confirmation link in a browser to confirm forwarding
10. Back in Gmail → select **Forward a copy of incoming mail to** your forwarding address
11. Choose **keep Gmail's copy in the Inbox**
12. Click **Save Changes**

## Step 7: Test the Pipeline

### Option A: Wait for a real bank email
Make a small transaction with your bank card. The bank alert email will be forwarded to Postmark → your webhook → stored as a transaction.

### Option B: Send a test email manually
Forward a bank alert email to your forwarding address manually from Gmail.

### Option C: Test with curl
```bash
curl -X POST https://your-railway-url.railway.app/webhook/email/<POSTMARK_WEBHOOK_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "From": "alerts@axisbank.com",
    "ToFull": [{"Email": "sync+abc123@mail.yourdomain.com", "Name": ""}],
    "Subject": "Transaction Alert",
    "TextBody": "Rs.450.00 has been debited from your a/c **1234 on 05-04-2026 for UPI/Swiggy/xyz",
    "HtmlBody": ""
  }'
```

### Verify in Railway Logs

- `[webhook] received email from=... to=...` → email arrived
- `[webhook] saved transaction: 450 at Swiggy for device kharcha-...` → parsed and stored
- `[webhook] could not parse email from ...` → email arrived but format not recognized

### Sync to Mobile App

Open the app → Device Sync → tap **Sync Now** → transactions should appear.

## Troubleshooting

### Webhook returns 401
- The token in the URL path doesn't match `POSTMARK_WEBHOOK_TOKEN` env var on Railway
- Double-check the Postmark webhook URL includes the correct token

### Webhook returns 400 "Missing required fields"
- The request body doesn't have `From`, `ToFull`, or `TextBody`
- Check Postmark Activity tab to see the raw email payload

### Webhook returns 400 "Invalid forwarding address"
- The `ToFull[0].Email` doesn't match the `sync+token@domain` pattern
- Check that `EMAIL_DOMAIN` matches the domain in the forwarding email

### Webhook returns 404 "Device not found"
- The forwarding email in the `To` address doesn't match any registered device
- The device may have been re-registered with a new forwarding email
- Check: `docker compose exec postgres psql -U postgres -d kharcha -c "SELECT * FROM devices;"`

### Gmail forwarding not working
- Check Gmail Settings → Forwarding tab → make sure forwarding is enabled
- Check Postmark Activity tab → see if emails are arriving
- Check Railway logs → see if webhook is being hit

### DNS not propagated
- Run `dig MX mail.yourdomain.com` — should show `inbound.postmarkapp.com`
- If not, wait and retry. Check you added the MX record to the correct DNS provider

### Emails parsed but no transactions in app
- Check the "Sync From" date in Device Sync — it may be set after the transaction date
- Try setting it to an earlier date and syncing again
- Check: `docker compose exec postgres psql -U postgres -d kharcha -c "SELECT * FROM transactions;"`

## Supported Banks

| Bank      | Sender Email              | Transaction Types |
|-----------|---------------------------|-------------------|
| Axis Bank | `alerts@axisbank.com`     | UPI debit/credit  |
| HDFC Bank | `alerts@hdfcbank.net`     | Credit card charge|

Only emails from these senders are parsed. All other forwarded emails are accepted (200) but return `parsed: false`.

## Cost

- **Postmark**: Free tier = 100 inbound emails/month (bank alerts are ~30-60/month)
- **Domain**: You already own it
- **MX record**: Free DNS setting
- **Railway**: Already running the backend
- **Total extra cost: $0**
