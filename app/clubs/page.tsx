import { redirect } from "next/navigation";

export default function ClubsIndexPage() {
  redirect("/protected");
}
