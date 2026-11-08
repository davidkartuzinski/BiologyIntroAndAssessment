import { Skeleton } from "@/components/ui/skeleton";

export function StudyLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full max-w-2xl" />
      <Skeleton className="h-40 w-full max-w-2xl" />
    </div>
  );
}
