// app/new/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NewAlias() {
  redirect("/offers/new");
}
