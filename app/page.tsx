// app/page.tsx
export default function HomePage() {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border p-4 shadow-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
          Tailwind OK
        </span>
        <p className="mt-3 text-sm text-gray-700">
          If this badge is black with white text and the card has a border + shadow, Tailwind is active.
        </p>
      </div>

      <h2 className="text-2xl font-bold">Welcome</h2>
      <p>This is the MVP scaffold. Use the nav to sign in and edit your profile.</p>

      <ul className="list-disc pl-5">
        <li>Profile onboarding</li>
        <li>Offers (create/manage)</li>
        <li>Browse &amp; Filters</li>
        <li>Requests &amp; Notifications</li>
      </ul>
    </section>
  );
}
