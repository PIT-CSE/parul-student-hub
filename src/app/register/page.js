"use client";

import { authAPI } from "@/lib/api";
import { signIn, useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

// Memoized loading spinner component
const LoadingSpinner = memo(({ size = "w-4 h-4" }) => (
  <div className={`${size} border-2 border-white border-t-transparent rounded-full animate-spin`}></div>
));

LoadingSpinner.displayName = "LoadingSpinner";

// Memoized Google button component
const GoogleButton = memo(({ onClick, loading, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className="w-full bg-white text-gray-700 font-semibold py-3 sm:py-3.5 md:py-4 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[48px]"
  >
    {loading ? (
      <div className="flex items-center justify-center gap-2">
        <LoadingSpinner />
        <span>Signing in...</span>
      </div>
    ) : (
      <>
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </>
    )}
  </button>
));

GoogleButton.displayName = "GoogleButton";

function RegisterContent() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1); // 1: Google auth, 2: Set password
  const [userEmail, setUserEmail] = useState("");

  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Memoized handlers
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleStartOver = useCallback(() => {
    setStep(1);
    setUserEmail("");
    setFormData({
      username: "",
      password: "",
      confirmPassword: "",
    });
  }, []);

  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleMount = () => setMounted(true);
    
    if (typeof window !== 'undefined' && window.requestIdleCallback) {
      window.requestIdleCallback(scheduleMount);
    } else {
      setTimeout(scheduleMount, 100);
    }

    // Check if user came from OAuth login and needs to complete setup
    const stepParam = searchParams.get("step");
    const emailParam = searchParams.get("email");

    if (stepParam === "2" && emailParam) {
      setStep(2);
      setUserEmail(decodeURIComponent(emailParam));
      toast.info(
        "Please complete your account setup by choosing a username and password."
      );
    }

    // Prefetch critical resources
    if (typeof window !== 'undefined') {
      // Prefetch the home page for after successful registration
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = '/';
      document.head.appendChild(link);
    }
  }, [searchParams]);

  useEffect(() => {
    // Handle OAuth callback - check if user completed OAuth but needs password setup
    if (session && session.user && !userEmail) {
      // Check if this user needs to complete setup
      if (session.user.isOAuthUser && !session.user.passwordSetupComplete) {
        setUserEmail(session.user.email);
        setStep(2);
        toast.info(
          "Google authentication successful! Please complete your account setup."
        );
      } else if (session.user.passwordSetupComplete) {
        // User is fully set up, redirect to home
        router.push("/");
      }
    }
  }, [session, userEmail, router]);

  const checkUserSetupStatus = async (email) => {
    try {
      setUserEmail(email);
      setStep(2);
      toast.info(
        "Please complete your account setup by choosing a username and password."
      );
    } catch (error) {
      console.error("Error checking user setup status:", error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);

      const result = await signIn("google", {
        redirect: false,
        callbackUrl: "/register",
      });

      if (result?.error) {
        console.error("Sign-in error details:", result.error);
        if (result.error === "AccessDenied") {
          toast.error(
            "Access denied: Please use your Parul University email address (@paruluniversity.ac.in)"
          );
        } else {
          toast.error(
            `Google sign-up failed: ${result.error}. Please try again.`
          );
        }
      } else if (result?.ok) {
        toast.success(
          "Google authentication successful! Checking your account status..."
        );
        // The useEffect will handle the next steps when session updates
      } else if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.info("Google authentication in progress...");
      }
    } catch (error) {
      console.error("Google sign-up error:", error);
      toast.error(`Google sign-up failed: ${error.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Basic validation
    if (!formData.username || !formData.password || !formData.confirmPassword) {
      toast.error("Please fill in all fields");
      setLoading(false);
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    // Validate username (no spaces, special characters, minimum length)
    const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
    if (!usernameRegex.test(formData.username)) {
      toast.error(
        "Username must be 3-20 characters long and contain only letters, numbers and no special characters "
      );
      setLoading(false);
      return;
    }

    try {
      const setupData = {
        username: formData.username,
        email: userEmail,
        password: formData.password,
      };

      await authAPI.completeOAuthSetup(setupData);

      toast.success(
        "Account setup completed successfully! You can now sign in."
      );

      // Redirect to login page
      router.push("/login?message=setup-complete");
    } catch (error) {
      console.error("Setup completion error:", error);
      if (
        error.message.includes(
          "Only @paruluniversity.ac.in email addresses are allowed"
        )
      ) {
        toast.error(
          "Access denied: Please use your Parul University email address (@paruluniversity.ac.in)"
        );
        setStep(1);
        setUserEmail("");
      } else if (error.message.includes("Username already taken")) {
        toast.error(
          "This username is already taken. Please choose a different username."
        );
      } else if (error.message.includes("User not found")) {
        toast.error(
          "Session expired. Please start the registration process again."
        );
        setStep(1);
        setUserEmail("");
      } else {
        toast.error(
          error.message || "Setup completion failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center relative">
      {/* Simple gradient overlay for visual appeal without heavy animations */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20"></div>

      <div className="relative z-10 w-full max-w-md px-3 sm:px-4 md:px-6">
        <div
          className={`transform transition-all duration-500 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {/* Logo/Title */}
          <div className="text-center mb-4 sm:mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
              Student Hub
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm md:text-base">
              {step === 1
                ? "Join our community! Sign up with Google to get started."
                : "Complete your account setup by choosing a username and password."}
            </p>
          </div>

          {/* Register Form */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl sm:rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-gray-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-gray-700">
              {step === 1 ? (
                // Step 1: Google OAuth Registration Only
                <div className="space-y-4 sm:space-y-6">
                  <div className="text-center mb-4">
                    <p className="text-gray-300 text-sm mb-3">
                      Sign up with your Parul University Google account to
                      create your Student Hub account.
                    </p>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                      <p className="text-blue-400 text-xs sm:text-sm font-medium">
                        🏫 Faculty/Staff Registration Only: Only faculty and staff can register new accounts
                      </p>
                      <p className="text-yellow-400 text-xs mt-2 font-medium">
                        📚 Students: If you have a student email (13-digit number), please use the <Link href="/login" className="underline hover:text-yellow-300">Login page</Link> instead
                      </p>
                    </div>
                  </div>

                  {/* Google Sign-Up Button */}
                  <GoogleButton
                    onClick={handleGoogleSignIn}
                    loading={googleLoading}
                    disabled={googleLoading}
                  />

                  <div className="text-center">
                    <p className="text-gray-400 text-xs sm:text-sm">
                      Already have an account?{" "}
                      <Link
                        href="/login"
                        className="text-purple-400 hover:text-purple-300 font-medium hover:underline transition-colors"
                      >
                        Sign in here
                      </Link>
                    </p>
                  </div>

                  {/* Back to Dashboard */}
                  <div className="text-center mt-8">
                    <button
                      onClick={() => router.push("/")}
                      className="inline-flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <span>←</span>
                      <span>Back to Dashboard</span>
                    </button>
                  </div>
                </div>
              ) : (
                // Step 2: Set Username and Password (REQUIRED)
                <form
                  onSubmit={handleSubmit}
                  className="space-y-3 sm:space-y-4 md:space-y-6"
                >
                  {userEmail && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 sm:p-4 mb-4">
                      <p className="text-green-400 text-xs sm:text-sm">
                        ✓ Google account connected: {userEmail}
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 sm:p-4 mb-4">
                    <p className="text-blue-400 text-xs sm:text-sm font-medium">
                      🔒 Security Requirement: You must create your own password
                      to complete registration
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="username"
                      className="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Username *
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className="w-full px-3 sm:px-4 py-3 sm:py-3.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 text-sm sm:text-base min-h-[44px]"
                      placeholder="Choose a unique username"
                      style={{ fontSize: "16px" }}
                      required
                    />
                    <p className="text-gray-400 text-xs mt-1">
                      3-20 characters, letters, numbers, hyphens, and
                      underscores only
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Password *
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-3 sm:px-4 py-3 sm:py-3.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 text-sm sm:text-base min-h-[44px]"
                      placeholder="Create a strong password"
                      style={{ fontSize: "16px" }}
                      required
                    />
                    <p className="text-gray-400 text-xs mt-1">
                      Minimum 6 characters required
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full px-3 sm:px-4 py-3 sm:py-3.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 text-sm sm:text-base min-h-[44px]"
                      placeholder="Confirm your password"
                      style={{ fontSize: "16px" }}
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleStartOver}
                      className="flex-1 bg-gray-600 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200 text-sm min-h-[48px] flex items-center justify-center"
                    >
                      Start Over
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-purple-600 text-white font-semibold py-3 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[48px] flex items-center justify-center"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <LoadingSpinner />
                          <span>Completing...</span>
                        </div>
                      ) : (
                        "Complete Registration"
                      )}
                    </button>
                  </div>

                  <div className="text-center mt-4">
                    <p className="text-gray-400 text-xs">
                      By completing registration, you agree to our Terms of
                      Service and Privacy Policy
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
