// /app/terms/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use — Harmonic Exchange',
  description:
    'Terms of Use for Harmonic Exchange, a gift-based community to exchange skills, services, and creativity.',
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
        <p className="mt-2 text-sm text-gray-600">
          Last updated: 2025-10-13
        </p>
      </div>

      <div className="hx-card space-y-6 p-6">
        <p className="text-gray-700">
          Welcome to Harmonic Exchange (“we”, “us”, “our”). By accessing or using our website,
          apps, or services (collectively, the “Service”), you agree to these Terms of Use
          (“Terms”). If you do not agree, please do not use the Service.
        </p>

        <section>
          <h2 className="text-xl font-semibold">1) What Harmonic Exchange Is</h2>
          <p className="mt-2 text-gray-700">
            Harmonic Exchange is a gift-based community for exchanging skills, services, and
            creativity. We are not a marketplace of paid transactions; participants give and
            receive voluntarily.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2) Your Account</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
            <li>You must provide accurate information when creating an account.</li>
            <li>You’re responsible for the security of your account and any activity on it.</li>
            <li>You must be at least 16 years old (or the age of digital consent in your region).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3) Community Guidelines</h2>
          <p className="mt-2 text-gray-700">
            Be kind, respectful, and safe. You agree not to use the Service to harass, spam,
            mislead, or harm others; to post illegal content; or to circumvent technical limits.
            We may moderate, remove content, or restrict accounts to keep the community healthy.
          </p>
          <p className="mt-2 text-gray-700">
            See also our{' '}
            <Link className="text-teal-700 underline" href="/community-guidelines">
              Community Guidelines
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4) Your Content</h2>
          <p className="mt-2 text-gray-700">
            You retain ownership of content you post (offers, requests, reviews, gratitude notes,
            messages, etc.). You grant us a non-exclusive, worldwide, royalty-free license to
            host, store, display, and share that content as needed to operate and improve the
            Service. You’re responsible for ensuring you have rights to share what you post.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5) No Professional Advice</h2>
          <p className="mt-2 text-gray-700">
            Content on the Service is provided by community members. We do not provide medical,
            legal, financial, or other professional advice. Use your judgment and consult
            qualified professionals when needed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6) Third-Party Services</h2>
          <p className="mt-2 text-gray-700">
            We integrate third parties (e.g., Supabase for authentication and hosting). Their
            services are subject to their own terms and policies. We are not responsible for
            third-party actions or outages.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7) Disclaimers</h2>
          <p className="mt-2 text-gray-700">
            The Service is provided “as is,” without warranties of any kind, express or implied.
            We do not guarantee uninterrupted or error-free operation, or the accuracy of user
            content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8) Limitation of Liability</h2>
          <p className="mt-2 text-gray-700">
            To the fullest extent permitted by law, we are not liable for indirect, incidental,
            special, consequential, or exemplary damages, or for lost profits, data, or goodwill.
            Our total liability for any claim relating to the Service is limited to the amount
            you paid us (typically $0) in the 12 months before the claim arose.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9) Termination</h2>
          <p className="mt-2 text-gray-700">
            You may stop using the Service at any time. We may suspend or terminate access if you
            violate these Terms or cause risk or harm. Sections that should survive termination
            (e.g., licenses, limitations, disclaimers) will survive.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10) Changes to These Terms</h2>
          <p className="mt-2 text-gray-700">
            We may update these Terms from time to time. If changes are material, we’ll provide
            reasonable notice (e.g., by email or an in-app notice). Your continued use means you
            accept the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">11) Contact</h2>
          <p className="mt-2 text-gray-700">
            Questions? Reach us at <a className="text-teal-700 underline" href="mailto:support@harmonic.exchange">support@harmonic.exchange</a>.
          </p>
        </section>
      </div>
    </section>
  );
}
