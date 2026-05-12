import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession, useUserProfile } from "../App";
import { trackEvent } from "../lib/analytics.js";
import TripableLogoLink from "./TripableLogoLink.jsx";
import LoadingProgressBar from "./LoadingProgressBar.jsx";

export function AuthStatus() {
  const session = useSession();
  const { refreshProfile } = useUserProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authMode = searchParams.get("mode");
  const isResetPassword = authMode === "reset-password";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(authMode !== "signin" && authMode !== "reset-password");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isBusy = loading || isRedirecting;

  const returnUrl = searchParams.get("return") || "/";

  useEffect(() => {
    if (authMode === "reset-password") {
      setIsSignUp(false);
      setIsForgotPassword(false);
      return;
    }
    if (authMode === "signin") {
      setIsSignUp(false);
      setIsForgotPassword(false);
      return;
    }
    if (authMode === "signup") {
      setIsSignUp(true);
      setIsForgotPassword(false);
    }
  }, [authMode]);

  useEffect(() => {
    if (isResetPassword) return;
    if (!session) return;
    setIsRedirecting(true);
    const timer = setTimeout(() => navigate(returnUrl), 5000);
    return () => clearTimeout(timer);
  }, [isResetPassword, session, navigate, returnUrl]);

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Error: Passwords do not match");
      return;
    }
    setLoading(true);
    setMessage("");

    const { data: existingUser, error: checkError } = await supabase
      .from("User")
      .select("id")
      .eq("email", email)
      .single();

    if (checkError === null && existingUser) {
      setMessage("Error: This email is already in use. Try signing in instead.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      void trackEvent("auth_sign_up_failed", {
        reason: error.message || "unknown"
      });
      setMessage(`Error: ${error.message}`);
    } else {
      void trackEvent("auth_sign_up_succeeded", {
        has_return_url: Boolean(returnUrl)
      });
      setMessage("Check your email for the confirmation link!");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => navigate(returnUrl), 5000);
    }
    setLoading(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      void trackEvent("auth_sign_in_failed", {
        reason: error.message || "unknown"
      });
      setMessage(`Error: ${error.message}`);
    } else {
      void trackEvent("auth_sign_in_succeeded", {
        has_return_url: Boolean(returnUrl)
      });
      setMessage("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      const { data } = await supabase.auth.getSession();
      const loadedProfile = await refreshProfile(data?.session || null);
      if (!loadedProfile) {
        setMessage("Error: This account is no longer active.");
        setLoading(false);
        return;
      }
      setIsRedirecting(true);
      setTimeout(() => navigate(returnUrl), 300);
    }
    setLoading(false);
  };

  const handlePasswordResetUpdate = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!session) {
      setMessage("Error: Open the password reset link from your email before choosing a new password.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Error: Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setMessage("Error: Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      void trackEvent("auth_password_reset_failed", {
        reason: error.message || "unknown"
      });
      setMessage(`Error: ${error.message}`);
    } else {
      void trackEvent("auth_password_reset_succeeded", {});
      setMessage("Password updated successfully. Redirecting...");
      setPassword("");
      setConfirmPassword("");
      setIsRedirecting(true);
      setTimeout(() => navigate("/profile"), 1200);
    }
    setLoading(false);
  };

  const readJsonResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();
    if (!rawBody) return {};
    if (!contentType.includes("application/json")) {
      throw new Error("Password reset service returned an unexpected response.");
    }
    return JSON.parse(rawBody);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const resetEmail = String(email || "").trim();
    setMessage("");

    if (!resetEmail) {
      setMessage("Error: Enter your email address first.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/send-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: resetEmail,
          redirectTo: `${window.location.origin}/auth?mode=reset-password`
        })
      });
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(result?.details || result?.error || "Unable to send password reset email.");
      }

      void trackEvent("auth_forgot_password_email_sent", {});
      setMessage("If this email belongs to an active account, a reset link has been sent.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      void trackEvent("auth_forgot_password_failed", {
        reason: error?.message || "unknown"
      });
      setMessage(`Error: ${error?.message || "Unable to send password reset email."}`);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    void trackEvent("auth_mode_switched", {
      next_mode: isSignUp ? "signin" : "signup"
    });
    setIsSignUp(!isSignUp);
    setIsForgotPassword(false);
    setMessage("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-[#ecf5e9] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="relative w-full rounded-[2rem] bg-white p-8 shadow-card lg:p-10">
          {isBusy ? (
            <>
              <div className="absolute inset-0 z-10 rounded-[2rem] bg-white/60" />
              <LoadingProgressBar indeterminate className="absolute left-0 top-0 z-20 rounded-t-[2rem]" />
            </>
          ) : null}
          <div className={isBusy ? "pointer-events-none select-none" : ""}>
            <TripableLogoLink className="mb-6" size="sm" showTagline={false} />
            <div className="mb-8">
              <h2 className="mt-2 text-3xl font-semibold text-[#1e4840]">
                {isResetPassword
                  ? "Reset Password"
                  : isForgotPassword
                    ? "Forgot Password"
                    : isSignUp
                      ? "Create Account"
                      : "Sign In"}
              </h2>
            </div>

            {isResetPassword ? (
              session ? (
                <form onSubmit={handlePasswordResetUpdate} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1e4840]">New Password</label>
                    <input
                      type="password"
                      placeholder="********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={isBusy}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1e4840] outline-none transition focus:border-[#1e4840]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1e4840]">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="********"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={isBusy}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#1e4840] outline-none transition focus:bg-white ${
                        password && confirmPassword && password !== confirmPassword
                          ? "border-red-300 bg-red-50 focus:border-red-500"
                          : password && confirmPassword && password === confirmPassword
                            ? "border-emerald-300 bg-emerald-50 focus:border-emerald-500"
                            : "border-slate-200 bg-white focus:border-[#1e4840]"
                      }`}
                    />
                    {password && confirmPassword && password !== confirmPassword ? (
                      <p className="mt-2 text-xs font-medium text-red-600">Passwords do not match</p>
                    ) : null}
                    {password && confirmPassword && password === confirmPassword ? (
                      <p className="mt-2 text-xs font-medium text-emerald-600">Passwords match</p>
                    ) : null}
                  </div>

                  {message ? (
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        message.includes("Error")
                          ? "bg-red-100 text-red-800"
                          : "bg-[#ecf5e9] text-[#1e4840]"
                      }`}
                    >
                      {message}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isBusy || !password || !confirmPassword || password !== confirmPassword}
                    className="w-full rounded-2xl bg-[#1e4840] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#152f2a] disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Update Password
                  </button>
                </form>
              ) : (
                <div className="rounded-2xl bg-[#ecf5e9] px-4 py-3 text-sm text-[#1e4840]">
                  Open the password reset link from your email to choose a new password.
                </div>
              )
            ) : (
              <>
                {isForgotPassword ? (
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#1e4840]">Email</label>
                      <input
                        type="email"
                        placeholder="your-email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isBusy}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1e4840] outline-none transition focus:border-[#1e4840]"
                      />
                    </div>

                    {message ? (
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm ${
                          message.includes("Error")
                            ? "bg-red-100 text-red-800"
                            : "bg-[#ecf5e9] text-[#1e4840]"
                        }`}
                      >
                        {message}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isBusy || !email.trim()}
                      className="w-full rounded-2xl bg-[#1e4840] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#152f2a] disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      Send Reset Email
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setIsForgotPassword(false);
                        setMessage("");
                      }}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-[#1e4840] transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      Back to Sign In
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="mb-8 flex gap-2 rounded-2xl bg-slate-100 p-1.5">
                      <button
                        onClick={() => (isSignUp ? null : switchMode())}
                        disabled={isBusy}
                        className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                          isSignUp
                            ? "bg-[#1e4840] text-white shadow-soft"
                            : isBusy
                              ? "text-[#1e4840]/55"
                              : "text-[#1e4840]/75 hover:bg-white"
                        }`}
                      >
                        Create Account
                      </button>
                      <button
                        onClick={() => (!isSignUp ? null : switchMode())}
                        disabled={isBusy}
                        className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                          !isSignUp
                            ? "bg-[#1e4840] text-white shadow-soft"
                            : isBusy
                              ? "text-[#1e4840]/55"
                              : "text-[#1e4840]/75 hover:bg-white"
                        }`}
                      >
                        Sign In
                      </button>
                    </div>

                    <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#1e4840]">Email</label>
                        <input
                          type="email"
                          placeholder="your-email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isBusy}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1e4840] outline-none transition focus:border-[#1e4840]"
                        />
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="block text-sm font-semibold text-[#1e4840]">Password</label>
                          {!isSignUp ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setIsForgotPassword(true);
                                setMessage("");
                                setPassword("");
                                setConfirmPassword("");
                              }}
                              className="text-xs font-semibold text-[#1e4840]/70 underline-offset-4 hover:text-[#1e4840] hover:underline disabled:opacity-60"
                            >
                              Forgot your password?
                            </button>
                          ) : null}
                        </div>
                        <input
                          type="password"
                          placeholder="********"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={isSignUp ? 6 : undefined}
                          disabled={isBusy}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1e4840] outline-none transition focus:border-[#1e4840]"
                        />
                      </div>

                      {isSignUp ? (
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-[#1e4840]">Confirm Password</label>
                          <input
                            type="password"
                            placeholder="********"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            disabled={isBusy}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm text-[#1e4840] outline-none transition focus:bg-white ${
                              password && confirmPassword && password !== confirmPassword
                                ? "border-red-300 bg-red-50 focus:border-red-500"
                                : password && confirmPassword && password === confirmPassword
                                  ? "border-emerald-300 bg-emerald-50 focus:border-emerald-500"
                                  : "border-slate-200 bg-white focus:border-[#1e4840]"
                            }`}
                          />
                          {password && confirmPassword && password !== confirmPassword ? (
                            <p className="mt-2 text-xs font-medium text-red-600">Passwords do not match</p>
                          ) : null}
                          {password && confirmPassword && password === confirmPassword ? (
                            <p className="mt-2 text-xs font-medium text-emerald-600">Passwords match</p>
                          ) : null}
                        </div>
                      ) : null}

                      {message ? (
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm ${
                            message.includes("Error")
                              ? "bg-red-100 text-red-800"
                              : "bg-[#ecf5e9] text-[#1e4840]"
                          }`}
                        >
                          {message}
                        </div>
                      ) : null}

                      <button
                        type="submit"
                        disabled={isBusy || (isSignUp && password && confirmPassword && password !== confirmPassword)}
                        className="w-full rounded-2xl bg-[#1e4840] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#152f2a] disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {isSignUp ? "Create Account" : "Sign In"}
                      </button>
                    </form>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
