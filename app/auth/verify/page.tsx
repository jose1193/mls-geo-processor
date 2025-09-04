"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const verifySchema = z.object({
  otp: z.string().length(6, "Code must be 6 digits"),
});

type VerifyForm = z.infer<typeof verifySchema>;

export default function VerifyPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get("email");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
  });

  const otpValue = watch("otp");

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      router.push("/");
    }
  }, [email, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const onSubmit = async (data: VerifyForm) => {
    if (!email) return;

    setIsLoading(true);
    setMessage(null);

    try {
      // Attempt to login with NextAuth
      const result = await signIn("credentials", {
        email,
        otp: data.otp,
        redirect: false,
      });

      if (result?.error) {
        setMessage({
          type: "error",
          text: "Incorrect or expired code",
        });
      } else if (result?.ok) {
        setMessage({
          type: "success",
          text: "Access authorized! Redirecting...",
        });

        // Redirect after a brief delay
        setTimeout(() => {
          router.push(callbackUrl);
        }, 1500);
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

  const resendCode = async () => {
    if (!email) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "New code sent to your email",
        });
        setTimeLeft(600); // Reset timer
      } else {
        setMessage({
          type: "error",
          text: "Error resending code",
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

  if (!email) {
    return <div>Redirecting...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Code Verification
        </h2>
        <p className="text-gray-600 mb-2">We sent a 6-digit code to:</p>
        <p className="text-blue-600 font-medium">{email}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp">Verification Code</Label>
          <Input
            id="otp"
            type="text"
            placeholder="123456"
            maxLength={6}
            disabled={isLoading}
            {...register("otp")}
            className={`text-center text-2xl tracking-widest ${
              errors.otp ? "border-red-500" : ""
            }`}
            autoComplete="one-time-code"
          />
          {errors.otp && (
            <p className="text-sm text-red-600">{errors.otp.message}</p>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            {timeLeft > 0 ? (
              <>
                Code expires in:{" "}
                <span className="font-mono text-blue-600">
                  {formatTime(timeLeft)}
                </span>
              </>
            ) : (
              <span className="text-red-600">Code expired</span>
            )}
          </p>
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
          disabled={isLoading || !otpValue || otpValue.length !== 6}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Verifying...
            </div>
          ) : (
            "Verify code"
          )}
        </Button>
      </form>

      <div className="flex flex-col space-y-3">
        <Button
          variant="outline"
          onClick={resendCode}
          disabled={isLoading || timeLeft > 540} // Allow resend after 1 minute
          className="w-full transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Resend code
        </Button>

        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="w-full text-gray-600 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          ← Back to login
        </Button>
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          Didn&apos;t receive the code? Check your spam folder or try resending
          after 1 minute
        </p>
      </div>
    </div>
  );
}
