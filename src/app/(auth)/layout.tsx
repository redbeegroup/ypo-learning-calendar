export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-900 to-blue-700 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="text-2xl font-bold">YPO SEA Learning Calendar</div>
          <div className="text-sm text-blue-200">South East Asia chapters</div>
        </div>
        {children}
      </div>
    </div>
  );
}
