// /app/page.tsx
export default function HomePage() {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold">Welcome</h2>
      <p>This is the MVP scaffold. Use the nav to sign in and edit your profile.</p>
      <ul className="list-disc pl-5">
        <li>Module 3 will add Profile onboarding.</li>
        <li>Module 4 will add Offers (create/manage).</li>
        <li>Module 5 will add Browse &amp; Filters.</li>
        <li>Module 6 will add Requests &amp; Notifications.</li>
      </ul>
    </section>
  )
}
