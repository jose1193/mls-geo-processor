import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication - MLS Processor",
  description: "Secure authentication system with OTP code",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">
            🌍 MLS Processor
          </h1>
          <p className="text-blue-600">Real Estate Data Processing System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
          {children}
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-blue-600">
            Secure passwordless authentication
          </p>
        </div>
      </div>
    </div>
  );
}
