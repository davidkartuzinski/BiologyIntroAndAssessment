import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto max-w-xl space-y-3 px-4 py-16">
      <h1 className="text-2xl font-semibold">You do not have access to this page</h1>
      <p>This page is for a different account role.</p>
      <Link href="/study" className="underline underline-offset-4">Back to the dashboard</Link>
    </main>
  );
}
