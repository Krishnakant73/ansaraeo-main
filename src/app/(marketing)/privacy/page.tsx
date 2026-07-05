import type { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AnsarAEO collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="container-x prose prose-sm max-w-3xl py-32 md:py-40">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Privacy Policy</h1>
        <p className="text-sm text-muted">Last updated: July 2026</p>

        <p>
          This Privacy Policy explains how AnsarAEO (&quot;we&quot;, &quot;us&quot;) collects, uses, stores, and
          protects your personal data, in line with India&apos;s Digital Personal Data Protection Act, 2023
          (DPDP Act) and applicable IT Rules.
        </p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li><strong>Account information:</strong> name, email address, company/brand name, password (encrypted).</li>
          <li><strong>Billing information:</strong> processed by our payment partners (Razorpay/Stripe) — we do not
            store your full card details ourselves.</li>
          <li><strong>Brand & prompt data:</strong> the brand names, domains, competitors, and prompts you choose
            to track.</li>
          <li><strong>Usage data:</strong> log data, device/browser information, and product analytics to improve
            the Service.</li>
          <li><strong>Cookies:</strong> see Section 6 below.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide, operate, and improve the Service (running your tracked prompts, generating reports).</li>
          <li>To communicate with you — service updates, weekly reports, billing notices, and (only with consent
            where required) marketing emails.</li>
          <li>To detect and prevent fraud, abuse, and security incidents.</li>
          <li>To comply with legal obligations.</li>
        </ul>

        <h2>3. How Your Data Is Processed by Third Parties</h2>
        <p>
          To run the Service, your tracked prompts are sent to third-party AI providers (such as OpenAI,
          Perplexity, and Google) solely to retrieve their AI-generated answers for visibility analysis. We use
          Supabase for database hosting and authentication, and Razorpay/Stripe for payment processing. Each of
          these providers has its own privacy practices governing data they process on our behalf.
        </p>

        <h2>4. Data Storage & Security</h2>
        <p>
          Your data is stored on Supabase&apos;s infrastructure with encryption in transit and at rest, and
          access-controlled via Row Level Security so that only your organization can access your own data. No
          method of transmission or storage is 100% secure, but we take reasonable technical and organizational
          measures to protect your data.
        </p>

        <h2>5. Your Rights (under the DPDP Act, 2023)</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction or erasure of your personal data.</li>
          <li>Withdraw consent for optional processing (e.g., marketing emails) at any time.</li>
          <li>Nominate another individual to exercise your rights in the event of your death or incapacity.</li>
          <li>Lodge a grievance with our Grievance Officer (see Section 8) or the Data Protection Board of India.</li>
        </ul>
        <p>To exercise any of these rights, email <a href="mailto:admin@ansaraeo.com">admin@ansaraeo.com</a>.</p>

        <h2>6. Cookies</h2>
        <p>
          We use essential cookies required for login sessions to work, and optional analytics cookies to
          understand product usage. You can manage your cookie preferences via the cookie banner shown on your
          first visit, or by clearing cookies in your browser settings. See our cookie banner for details on
          accepting or declining non-essential cookies.
        </p>

        <h2>7. Data Retention</h2>
        <p>
          We retain your account and brand data for as long as your account is active. If you close your
          account, we will delete or anonymize your personal data within a reasonable period, except where we
          are required to retain it for legal, accounting, or fraud-prevention purposes.
        </p>

        <h2>8. Grievance Officer</h2>
        <p>
          In accordance with the Information Technology Act, 2000 and rules made thereunder, and the DPDP Act,
          2023, the contact details of the Grievance Officer are:
        </p>
        <p>
          Email: <a href="mailto:admin@ansaraeo.com">admin@ansaraeo.com</a>
        </p>

        <h2>9. Children&apos;s Privacy</h2>
        <p>The Service is not directed at individuals under 18. We do not knowingly collect data from minors.</p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy periodically. Material changes will be notified via email or an
          in-product notice.
        </p>

        <h2>11. Contact</h2>
        <p>
          For any privacy-related questions, contact us at{" "}
          <a href="mailto:admin@ansaraeo.com">admin@ansaraeo.com</a>.
        </p>
      </main>
      <Footer />
    </>
  );
}
