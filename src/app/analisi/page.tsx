import { redirect } from "next/navigation";

export default function AnalisiRedirect() {
  redirect("/events?filter=analyzed");
}
