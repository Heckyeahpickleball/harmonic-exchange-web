// app/my-offers/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MyOffersAlias() {
  redirect("/offers/mine");
}
