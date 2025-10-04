// app/dev/badges/page.tsx
import Badge from "@/components/Badge";

export default function BadgesPlayground() {
  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Badges Playground</h1>

      <div className="grid grid-cols-5 gap-4">
        {[1,2,3,4,5,6].map(tier =>
          [1,2,3,4,5].map(stars => (
            <div key={`${tier}-${stars}`} className="flex flex-col items-center gap-2">
              <Badge tier={tier} stars={stars} size={72} />
              <div className="text-sm text-gray-500">T{tier} · {stars}★</div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
