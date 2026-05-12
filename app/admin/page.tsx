import { redirect } from "next/navigation";

// The bare /admin route always lands on the Closers tab. Tabs themselves are
// real routes under /admin/<tab>, so URLs are shareable + bookmarkable.
export default function AdminIndex() {
  redirect("/admin/closers");
}
