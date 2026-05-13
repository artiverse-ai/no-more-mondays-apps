# Putting the dashboard on `apps.nomoremondays.io`

Owner: Shahriar
Audience: anyone touching DNS for `nomoremondays.io`
Last updated: 2026-05-13

---

## Where the domain lives today

`nomoremondays.io` was bought at **Namecheap**. That's our registrar — the company that owns the paperwork, processes renewals, and could in theory transfer the domain elsewhere.

But here's the twist that catches people: **DNS records for this domain are not at Namecheap.** Whoever originally set the domain up pointed its nameservers at **Cloudflare**:

```
$ dig NS nomoremondays.io +short
joyce.ns.cloudflare.com.
scott.ns.cloudflare.com.

$ whois nomoremondays.io
Registrar: NameCheap, Inc.
Name Server: scott.ns.cloudflare.com
Name Server: joyce.ns.cloudflare.com
```

Namecheap itself is telling us: *"if you want to add a DNS record, go to Cloudflare."*

### Why this matters

Two different jobs, two different vendors:

| Job | Vendor | What it means |
|---|---|---|
| **Registrar** (owns the domain name) | Namecheap | Where you renew / transfer ownership |
| **DNS host** (serves DNS records) | Cloudflare | Where you actually add records like `apps`, `www`, MX, TXT verification |

Adding records at Namecheap **will not work** — the world doesn't read Namecheap's DNS for this domain. Browsers ask Cloudflare. Records must be added there.

### How does the system know to use Cloudflare?

The `whois` output above shows `Name Server: scott.ns.cloudflare.com` etc. That line is set inside Namecheap's domain admin panel — it's the only DNS-related thing Namecheap *does* serve, and it's a pointer that says "for everything else, ask these servers." That's the delegation.

If you ever want to move DNS back to Namecheap, you go into Namecheap → Domain → Nameservers → switch from "Custom DNS" back to "Namecheap BasicDNS". Takes 24-48hr to propagate. **Don't do this casually** — it would break anything currently served from Cloudflare DNS.

---

## What we're doing

The internal apps dashboard (Funnel Search, Calendar Hygiene, Webinar Performance, Site Access admin) currently lives at:

```
https://no-more-mondays-apps.vercel.app
```

We want it at a clean URL on our own domain:

```
https://apps.nomoremondays.io
```

The Vercel project is already configured to accept this subdomain — Vercel is just waiting for us to prove we own `nomoremondays.io` and to set up the DNS record so traffic actually points its way.

---

## The two DNS records we need

Both go into **Cloudflare** (not Namecheap).

### Record 1 — Ownership proof (TXT)

Vercel needs a one-time TXT record to prove we control `nomoremondays.io` before it'll issue an SSL cert for the subdomain.

| Field | Value |
|---|---|
| Type | `TXT` |
| Name | `_vercel` |
| Content | `vc-domain-verify=apps.nomoremondays.io,b93b25eb86137a34f945` |
| TTL | Auto |

### Record 2 — The subdomain itself (CNAME)

This is what makes `apps.nomoremondays.io` actually resolve to our Vercel deployment.

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `apps` |
| Target | `cname.vercel-dns.com` |
| **Proxy status** | **DNS only (grey cloud, NOT orange)** |
| TTL | Auto |

**The proxy status is the one detail people get wrong.** Cloudflare defaults new records to "proxied" (orange cloud), which routes traffic through Cloudflare's CDN. Vercel needs the direct CNAME so it can issue and serve its own SSL cert. If the cloud stays orange, the site loads with a Cloudflare 526 or 522 error and SSL won't provision.

---

## Step-by-step (for whoever has Cloudflare access)

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) and pick the **nomoremondays.io** zone.
2. Left sidebar → **DNS** → **Records** → **Add record**.
3. Add **Record 1** (TXT) using the values in the table above. Click **Save**.
4. Add **Record 2** (CNAME) using the values above. **Confirm the proxy column shows the grey cloud icon ("DNS only"), not orange.** Click **Save**.
5. Wait ~1–5 minutes for DNS to propagate (Cloudflare is fast).
6. Ping Shahriar back. He'll verify on Vercel's side that the domain is verified and the SSL cert has been issued (~30 seconds after detection), and confirm `https://apps.nomoremondays.io` resolves correctly.

---

## Verifying it worked

After Marek/Taziem says the records are in, Shahriar runs:

```bash
# 1. TXT record present?
dig TXT _vercel.nomoremondays.io +short
# Expected: "vc-domain-verify=apps.nomoremondays.io,b93b25eb86137a34f945"

# 2. CNAME resolving?
dig CNAME apps.nomoremondays.io +short
# Expected: cname.vercel-dns.com.

# 3. SSL working?
curl -sS -o /dev/null -w "%{http_code}\n" https://apps.nomoremondays.io/apps/calendly-search
# Expected: 307 (Clerk redirecting unauthenticated visitor to sign-in)
```

Then open `https://apps.nomoremondays.io/apps/calendly-search` in an incognito tab. Sign in with Clerk. Funnel Search should load just like it does on the `.vercel.app` URL.

---

## Who to ask if something breaks

- **DNS not propagating**: wait 15 min, then check from another network (or [https://www.whatsmydns.net/#CNAME/apps.nomoremondays.io](https://www.whatsmydns.net/#CNAME/apps.nomoremondays.io)). Cloudflare TTLs are short so propagation is usually <5 min.
- **Vercel says "domain not verified"**: the TXT record may have a typo. Re-paste it exactly from this doc.
- **SSL 526/522/525 error in the browser**: the CNAME's proxy status is set to orange (proxied). Switch it to grey (DNS only) in Cloudflare. Wait 1 min, try again.
- **`accounts.dev` still shows up during sign-in**: that's expected — we're staying on Clerk's Development instance for now. If you want it cleaned up, that's a separate ~30-min migration to a Clerk Production instance (which would require re-inviting every user once).

---

## Future: moving to a "real" production Clerk

This setup uses Clerk's **Development** instance — fine for an internal tool with <100 users. If we ever want clean Clerk URLs (no `accounts.dev` blip during sign-in), branded email templates, or SSO, we'd do a separate migration:

1. Create a Clerk **Production** instance in the Clerk dashboard.
2. Add a CNAME for `accounts.nomoremondays.io` → Clerk's edge (records provided when you create the prod instance).
3. Swap `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in Vercel's env vars to the prod keys.
4. Re-invite every human (5 minutes — paste emails into `/admin/access`).
5. Re-toggle admin role for whoever needs it.

Not urgent. Doc here so future-us doesn't forget the steps.
