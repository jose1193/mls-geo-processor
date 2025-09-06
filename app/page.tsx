"use client";

import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  // Show message if redirected from protected route
  const redirectMessage = searchParams.get("callbackUrl")
    ? "Please sign in to access this page"
    : null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Code sent to your email. Please check your inbox.",
        });

        // Redirect to verification page after 2 seconds
        setTimeout(() => {
          router.push(
            `/auth/verify?email=${encodeURIComponent(data.email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`
          );
        }, 2000);
      } else {
        setMessage({
          type: "error",
          text: result.error || "Error sending code",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Connection error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-900 mb-3">
            🌍 MLS Processor
          </h1>
          <p className="text-lg text-blue-700 mb-2">
            Real Estate Data Processing System
          </p>
          <p className="text-sm text-blue-600">
            Geographic enrichment system for real estate data processing
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Enter your email to receive an access code
            </p>
            {redirectMessage && (
              <p className="text-sm text-orange-600 mt-2">{redirectMessage}</p>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your-email@example.com"
                disabled={isLoading}
                {...register("email")}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <Button
              type="submit"
              className="w-full transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Sending code...
                </div>
              ) : (
                "Send access code"
              )}
            </Button>
          </form>

          <div className="text-center mt-6">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 116 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Secure passwordless authentication</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-4">
          <div className="flex items-center justify-center space-x-6 text-xs text-blue-600">
            <a
              href="https://nextjs.org/learn"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              <Image
                src="/file.svg"
                alt="File icon"
                width={12}
                height={12}
                className="opacity-60"
              />
              Learn
            </a>
            <a
              href="https://vercel.com/templates?framework=next.js"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              <Image
                src="/window.svg"
                alt="Window icon"
                width={12}
                height={12}
                className="opacity-60"
              />
              Examples
            </a>
            <a
              href="https://nextjs.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              <Image
                src="/globe.svg"
                alt="Globe icon"
                width={12}
                height={12}
                className="opacity-60"
              />
              Next.js
            </a>
          </div>

          <div className="flex items-center justify-center space-x-2">
            <span className="text-xs text-gray-400">Powered by</span>
            <Image
              src="/next.svg"
              alt="Next.js logo"
              width={60}
              height={12}
              className="opacity-40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-blue-600 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginComponent />
    </Suspense>
  );
}
