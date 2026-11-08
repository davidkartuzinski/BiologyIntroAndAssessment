import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Suspense>
        <SignIn />
      </Suspense>
    </div>
  );
}
