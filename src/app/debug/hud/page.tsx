import { redirect } from "next/navigation";

export default function DebugHudPage() {
  redirect("/e/our-wedding?debug=1");
}
