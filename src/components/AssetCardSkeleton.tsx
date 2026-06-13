import Skeleton from './Skeleton';

interface AssetCardSkeletonProps {
  count?: number;
}

export default function AssetCardSkeleton({ count = 6 }: AssetCardSkeletonProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-10" />
          </div>
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1 h-3 w-2/3" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-7 w-full" />
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <Skeleton className="h-3 w-20" />
            <div className="flex gap-1">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
