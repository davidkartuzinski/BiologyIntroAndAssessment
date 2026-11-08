import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Suspense>
        <SignUp />
      </Suspense>
    </div>
  );
}
