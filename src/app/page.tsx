import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-8">
        <Badge variant="secondary">Private study space</Badge>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Biology study
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            A quiet place to ask questions, define words, and work through
            ideas with a patient tutor. Sign in to open the study desk.
          </p>
        </div>
        <Suspense fallback={<div className="h-9" />}>
          <div className="flex flex-wrap items-center gap-3">
            <Show when="signed-out">
              <SignInButton>
                <Button>Sign in</Button>
              </SignInButton>
              <SignUpButton>
                <Button variant="outline">Create account</Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Button asChild>
                <Link href="/study">Continue studying</Link>
              </Button>
              <UserButton />
            </Show>
          </div>
        </Suspense>
      </div>
    </main>
  );
}
