import Skeleton from './Skeleton';

interface AssetTableSkeletonProps {
  rows?: number;
}

export default function AssetTableSkeleton({ rows = 8 }: AssetTableSkeletonProps) {
  return (
    <div className="section-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-5 py-3 font-medium">资产</th>
              <th className="px-5 py-3 font-medium">类型</th>
              <th className="px-5 py-3 font-medium">描述</th>
              <th className="px-5 py-3 font-medium">安装平台</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">风险</th>
              <th className="px-5 py-3 font-medium">修改时间</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <tr key={i} className="border-t border-gray-50">
                <td className="px-5 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-5 py-3"><Skeleton className="h-4 w-16" /></td>
                <td className="px-5 py-3"><Skeleton className="h-4 w-40" /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </td>
                <td className="px-5 py-3"><Skeleton className="h-5 w-14 rounded-md" /></td>
                <td className="px-5 py-3"><Skeleton className="h-5 w-10 rounded-md" /></td>
                <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-7 w-7 rounded-lg" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
