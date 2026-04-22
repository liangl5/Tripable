import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { useSession, useUserProfile } from "../App";
import { supabase } from "../lib/supabase.js";
import { updateUserProfileName } from "../lib/userProfile.js";
import { trackEvent } from "../lib/analytics.js";

export default function UserProfilePage() {
  const navigate = useNavigate();
  const session = useSession();
  const { profile, refreshProfile } = useUserProfile();
  const [newDisplayName, setNewDisplayName] = useState(profile?.name || "");
  const [displayNameMessage, setDisplayNameMessage] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);
  const [resetPasswordMessage, setResetPasswordMessage] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [deleteAccountMessage, setDeleteAccountMessage] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const handleUpdateDisplayName = async (e) => {
    e.preventDefault();
    setDisplayNameMessage("");
    setDisplayNameError("");

    if (!newDisplayName.trim()) {
      setDisplayNameError("Display name cannot be empty.");
      return;
    }

    try {
      setIsUpdatingDisplayName(true);  
      await updateUserProfileName(session, newDisplayName);
      await refreshProfile();
      void trackEvent("profile_display_name_updated", {
        length: newDisplayName.trim().length
      });
      setDisplayNameMessage("Display name updated successfully!");
      setTimeout(() => setDisplayNameMessage(""), 5000);
    } catch (error) {
      void trackEvent("profile_display_name_update_failed", {
        reason: error?.message || "unknown"
      });
      setDisplayNameError(error?.message || "Failed to update display name.");
    } finally {
      setIsUpdatingDisplayName(false);
    }
  };

  const handleResetPassword = async () => {
    setResetPasswordMessage("");
    setResetPasswordError("");

    if (!session?.user?.email) {
      setResetPasswordError("We could not find an email address for this account.");
      return;
    }

    void trackEvent("profile_reset_password_clicked", {});
    setConfirmDialog({
      type: "resetPassword",
      title: "Send password reset email?",
      message: `We will send a secure password reset link to ${session.user.email}. Continue?`,
      confirmText: "Send reset link",
      tone: "warning"
    });
  };

  const handleDeleteAccount = async () => {
    setDeleteAccountMessage("");
    setDeleteAccountError("");

    void trackEvent("profile_delete_account_clicked", {
      confirmed: Boolean(deleteConfirmed)
    });
    if (!deleteConfirmed) {
      setDeleteAccountError("Please confirm you want to delete your account.");
      return;
    }

    setConfirmDialog({
      type: "deleteAccount",
      title: "Delete account permanently?",
      message: "This will delete your Tripable account and owned trips. Contributions in other trips will remain under an anonymized deleted user name. This cannot be undone.",
      confirmText: "Delete account",
      tone: "danger"
    });
  };

  const handleConfirmResetPassword = async () => {
    const email = session?.user?.email;
    if (!email) {
      setResetPasswordError("We could not find an email address for this account.");
      setConfirmDialog(null);
      return;
    }

    try {
      setIsResettingPassword(true);
      setResetPasswordMessage("");
      setResetPasswordError("");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset-password`
      });
      if (error) throw error;

      void trackEvent("profile_reset_password_email_sent", {});
      setConfirmDialog(null);
      setResetPasswordMessage(`Password reset email sent to ${email}.`);
    } catch (error) {
      void trackEvent("profile_reset_password_failed", {
        reason: error?.message || "unknown"
      });
      setResetPasswordError(error?.message || "Unable to send a password reset email.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const readJsonResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();
    if (!rawBody) return {};
    if (!contentType.includes("application/json")) {
      throw new Error("Account service returned an unexpected response.");
    }
    return JSON.parse(rawBody);
  };

  const handleConfirmDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      setDeleteAccountMessage("");
      setDeleteAccountError("");

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const activeSession = data?.session || session;
      if (!activeSession?.access_token || !activeSession?.user?.email) {
        throw new Error("Please sign in again before deleting your account.");
      }

      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSession.access_token}`
        },
        body: JSON.stringify({
          email: activeSession.user.email,
          userId: activeSession.user.id
        })
      });
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(result?.details || result?.error || "Unable to delete your account right now.");
      }

      void trackEvent("profile_delete_account_succeeded", {});
      setDeleteAccountMessage("Account deleted.");
      setConfirmDialog(null);
      await supabase.auth.signOut();
      navigate("/");
    } catch (error) {
      void trackEvent("profile_delete_account_failed", {
        reason: error?.message || "unknown"
      });
      setDeleteAccountError(error?.message || "Unable to delete your account right now.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleConfirmAction = () => {
    if (confirmDialog?.type === "resetPassword") {
      void handleConfirmResetPassword();
      return;
    }
    if (confirmDialog?.type === "deleteAccount") {
      void handleConfirmDeleteAccount();
    }
  };

  if (!session) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#ecf5e9]">
      <Header />
      <div className="mx-auto flex max-w-2xl flex-col px-6 py-12">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm font-semibold text-[#1e4840]/70">
          <Link to="/" className="transition hover:text-[#1e4840]">
            Home
          </Link>
          <span className="mx-2 text-[#1e4840]/40">/</span>
          <span className="text-[#1e4840]" aria-current="page">
            Profile
          </span>
        </nav>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-ink">Profile Settings</h1>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Account Information</h2>
          
          <form onSubmit={handleUpdateDisplayName} className="mb-6">
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={session?.user?.email || ""}
                disabled
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 disabled:cursor-not-allowed"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="displayName" className="block text-sm font-medium text-ink mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                maxLength={40}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean"
              />
              <p className="text-xs text-slate-500 mt-1">{newDisplayName.length}/40 characters</p>
            </div>

            <button
              type="submit"
              disabled={isUpdatingDisplayName || newDisplayName === (profile?.name || "")}
              className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-[#152f2a] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingDisplayName ? "Updating..." : "Update Display Name"}
            </button>

            {displayNameMessage && (
              <p className="mt-3 text-sm text-green-600">{displayNameMessage}</p>
            )}
            {displayNameError && (
              <p className="mt-3 text-sm text-coral">{displayNameError}</p>
            )}
          </form>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Password Management</h2>
          <p className="text-sm text-slate-600 mb-4">
            Change your password to secure your account.
          </p>
          <button
            onClick={handleResetPassword}
            disabled={isResettingPassword}
            className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-[#152f2a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResettingPassword ? "Sending..." : "Reset Password"}
          </button>
          {resetPasswordMessage && (
            <p className="mt-3 text-sm text-green-600">{resetPasswordMessage}</p>
          )}
          {resetPasswordError && (
            <p className="mt-3 text-sm text-coral">{resetPasswordError}</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Danger Zone</h2>
          <p className="text-sm text-slate-600 mb-4">
            Delete your account and trips you own. Contributions in other trips will stay visible as an anonymized deleted user.
          </p>
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={deleteConfirmed}
              onChange={(e) => setDeleteConfirmed(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-slate-600">
              I understand this will delete my account and owned trips
            </span>
          </label>
          <button
            onClick={handleDeleteAccount}
            disabled={!deleteConfirmed || isDeletingAccount}
            className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeletingAccount ? "Deleting..." : "Delete Account"}
          </button>
          {deleteAccountMessage && (
            <p className="mt-3 text-sm text-green-600">{deleteAccountMessage}</p>
          )}
          {deleteAccountError && (
            <p className="mt-3 text-sm text-coral">{deleteAccountError}</p>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmText={confirmDialog?.confirmText}
        tone={confirmDialog?.tone}
        loading={isResettingPassword || isDeletingAccount}
        showLoadingBar={confirmDialog?.type === "deleteAccount"}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
