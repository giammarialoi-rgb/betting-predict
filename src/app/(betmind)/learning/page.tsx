import { redirect } from "next/navigation";

/** Legacy path → canonical /learn */
export default function LearningRedirect() {
  redirect("/learn");
}
