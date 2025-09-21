// app/browse/page.tsx
import { redirect } from "next/navigation";

// Make /browse behave exactly like /offers.
export const dynamic = "force-dynamic";

export default function BrowseAlias() {
  redirect("/offers");
}
