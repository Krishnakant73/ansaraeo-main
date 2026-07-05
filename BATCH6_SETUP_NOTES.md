# Batch 6 — Legal Pages, About/Contact, Cookie Consent, Terms Checkbox

## 1. Install the one new dependency (for the contact form email)
```bash
npm install nodemailer
npm install -D @types/nodemailer
```

## 2. Add to `.env.local`
```
ZOHO_SMTP_HOST=smtp.zoho.com   # use smtp.zoho.in instead if your Zoho account is on the India data center
ZOHO_SMTP_USER=admin@ansaraeo.com
ZOHO_SMTP_PASS=your-zoho-app-password
```

**Getting the Zoho App Password (required if 2FA is on, which it should be):**
1. Log into Zoho Mail as admin@ansaraeo.com
2. Settings (gear icon) → Security → App Passwords
3. Generate a new app password, name it "AnsarAEO Website"
4. Copy it into `ZOHO_SMTP_PASS` — this is NOT your normal Zoho login password

**Not sure if you're on smtp.zoho.com or smtp.zoho.in?**
Zoho Mail → Settings → Mail Accounts → click your address → check the IMAP/POP/SMTP
section, it will show the exact host for your account's data center.

## 3. Files in this batch (new or updated)

| File | Status |
|---|---|
| `src/app/(marketing)/terms/page.tsx` | New — full Terms & Conditions |
| `src/app/(marketing)/privacy/page.tsx` | New — full Privacy Policy (DPDP Act–aware) |
| `src/app/(marketing)/refund-policy/page.tsx` | New — transparent refund/cancellation policy |
| `src/app/(marketing)/about/page.tsx` | New — About Us |
| `src/app/(marketing)/contact/page.tsx` | New — Contact Us with working form |
| `src/components/shared/ContactForm.tsx` | New — the form itself |
| `src/app/api/contact/route.ts` | New — sends the form to admin@ansaraeo.com via Zoho SMTP |
| `src/components/shared/CookieConsent.tsx` | New — cookie banner, shown once, choice saved in localStorage |
| `src/app/layout.tsx` | Updated — now renders `<CookieConsent />` on every page |
| `src/components/footer/Footer.tsx` | Updated — Terms/Privacy/Refund now link to their own real pages (were all pointing to `/terms` before); added About/Contact |
| `src/app/sitemap.ts` | Updated — includes all new routes for SEO |
| `src/app/(auth)/signup/page.tsx` | Updated — required "I agree to Terms & Privacy Policy" checkbox; signup button is disabled until checked; also stores `terms_accepted_at` timestamp in the user's metadata for compliance record-keeping |

## 4. Important legal note (repeating this deliberately)

I'm not a lawyer, and the Terms/Privacy/Refund Policy pages are a reasonable **starting
template**, not a substitute for real legal review. Before you actually launch and start
taking payments:
- Have an Indian lawyer review these three pages, especially around the DPDP Act 2023
  (India's data protection law is still maturing in enforcement — get it right early)
- Update the "Governing Law" / jurisdiction clause with your actual city/state if you want
  a specific court named instead of just "India"
- If you incorporate as a private limited company, update all references from "we/us" to
  your actual registered company name

## 5. Test the contact form
```bash
npm run dev
```
Go to `/contact`, fill the form, submit. Check the admin@ansaraeo.com inbox — you should
receive the message with "Reply-To" already set to the visitor's email, so hitting Reply
in your inbox goes straight back to them.
