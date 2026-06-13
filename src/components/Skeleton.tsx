interface SkeletonProps {
  className?: string;
  count?: number;
}

export default function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  if (count === 1) {
    return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
  }

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`animate-pulse rounded bg-gray-200 ${className}`} />
      ))}
    </>
  );
}
