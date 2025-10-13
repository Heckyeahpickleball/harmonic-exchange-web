// /app/privacy/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Harmonic Exchange',
  description:
    'Privacy Policy for Harmonic Exchange: what we collect, how we use it, and your choices.',
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-600">
          Last updated: 2025-10-13
        </p>
      </div>

      <div className="hx-card space-y-6 p-6">
        <p className="text-gray-700">
          Your privacy matters to us. This policy explains what personal information we collect,
          how we use it, and the choices you have. This Privacy Policy works together with our{' '}
          <Link className="text-teal-700 underline" href="/terms">
            Terms of Use
          </Link>
          .
        </p>

        <section>
          <h2 className="text-xl font-semibold">1) Information We Collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-gray-700">
            <li>
              <span className="font-medium">Account info:</span> name, email, password hash,
              and optional profile details (bio, links, location, photo).
            </li>
            <li>
              <span className="font-medium">Community content:</span> offers, requests, reviews,
              gratitude notes, messages, and any attachments you choose to share.
            </li>
            <li>
              <span className="font-medium">Usage data:</span> device/browser info, IP address,
              pages viewed, and basic analytics events (if enabled).
            </li>
            <li>
              <span className="font-medium">Cookies/local storage:</span> used for secure login
              sessions and basic preferences.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2) How We Use Information</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-gray-700">
            <li>Provide, secure, and improve the Service.</li>
            <li>Create and manage your account and profile.</li>
            <li>Enable community features (offers, requests, reviews, gratitude).</li>
            <li>Communicate with you (e.g., confirmations, notifications, support).</li>
            <li>Detect, prevent, and investigate abuse or violations of our policies.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3) Legal Bases (where applicable)</h2>
          <p className="mt-2 text-gray-700">
            Depending on your location, we rely on consent, contract necessity (providing the
            Service), and legitimate interests (security, improvement) to process data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4) Sharing & Service Providers</h2>
          <p className="mt-2 text-gray-700">
            We use trusted providers to host and operate the Service (e.g., Supabase for auth,
            database, storage; Vercel for hosting). These providers process data on our behalf and
            follow contractual privacy and security commitments. We do not sell personal data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5) Data Retention</h2>
          <p className="mt-2 text-gray-700">
            We keep personal data for as long as needed to provide the Service and for legitimate
            business needs (e.g., security, backups), unless you request deletion or the account
            is closed, subject to legal obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6) Security</h2>
          <p className="mt-2 text-gray-700">
            We apply reasonable technical and organizational measures to protect data (TLS, access
            controls, role-based access, and audit). No method of transmission or storage is 100%
            secure, so we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7) Your Choices & Rights</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-gray-700">
            <li>Access, update, or delete your profile information.</li>
            <li>Export your data on request.</li>
            <li>Opt out of non-essential emails.</li>
            <li>
              Depending on your region (e.g., GDPR/UK GDPR/CPRA), you may have additional rights:
              access, correction, deletion, portability, restriction, and objection. We’ll honor
              verified requests as required by law.
            </li>
          </ul>
          <p className="mt-2 text-gray-700">
            To exercise rights, contact us at{' '}
            <a className="text-teal-700 underline" href="mailto:privacy@harmonic.exchange">
              privacy@harmonic.exchange
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8) International Transfers</h2>
          <p className="mt-2 text-gray-700">
            We may process data in the country where you live and in other countries where our
            providers operate. We use appropriate safeguards where required.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9) Children</h2>
          <p className="mt-2 text-gray-700">
            The Service is not directed to children under 16 (or the age of digital consent in
            your region). If you believe a child has provided us personal data, contact us and we
            will take appropriate steps.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10) Changes to This Policy</h2>
          <p className="mt-2 text-gray-700">
            We may update this policy from time to time. If changes are material, we’ll provide
            reasonable notice (e.g., by email or an in-app notice).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">11) Contact</h2>
          <p className="mt-2 text-gray-700">
            Questions or requests? Email{' '}
            <a className="text-teal-700 underline" href="mailto:privacy@harmonic.exchange">
              privacy@harmonic.exchange
            </a>.
          </p>
        </section>
      </div>
    </section>
  );
}
