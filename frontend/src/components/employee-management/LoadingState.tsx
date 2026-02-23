export function LoadingState() {
  return (
    <>
      {/* Desktop skeleton */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={`desktop-${i}`} className="hidden lg:grid grid-cols-[120px_200px_1fr_120px_140px_260px] gap-6 px-6 py-6 min-h-[80px] border-b border-mint-100">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
      ))}
      {/* Tablet skeleton */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={`tablet-${i}`} className="hidden md:grid lg:hidden grid-cols-[100px_150px_1fr_180px] gap-6 px-4 py-6 min-h-[80px] border-b border-mint-100">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
      ))}
      {/* Mobile skeleton */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={`mobile-${i}`} className="grid md:hidden grid-cols-[1fr_auto] gap-6 px-4 py-6 min-h-[80px] border-b border-mint-100">
          <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-16 w-24 bg-gray-200 rounded animate-pulse"></div>
        </div>
      ))}
    </>
  );
}

