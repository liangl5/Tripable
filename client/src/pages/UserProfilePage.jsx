import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useSession, useUserProfile } from "../App";
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
  const [deleteAccountMessage, setDeleteAccountMessage] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

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
    void trackEvent("profile_reset_password_clicked", {});
    // TODO: Implement password reset functionality
    setResetPasswordMessage("Password reset feature coming soon. Our team will implement this.");
  };

  const handleDeleteAccount = async () => {
    void trackEvent("profile_delete_account_clicked", {
      confirmed: Boolean(deleteConfirmed)
    });
    if (!deleteConfirmed) {
      setDeleteAccountMessage("Please confirm you want to delete your account.");
      return;
    }
    // TODO: Implement account deletion functionality
    setDeleteAccountMessage("Account deletion feature coming soon. Our team will implement this.");
  };

  const handleGoToDashboard = () => {
    navigate("/");
  };

  if (!session) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#ecf5e9]">
      <Header />
      <div className="mx-auto flex max-w-2xl flex-col px-6 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-ink">Profile Settings</h1>
          <button
            type="button"
            onClick={handleGoToDashboard}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#1e4840] hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
              <path d="M10 21v-6h4v6" />
            </svg>
            Home
          </button>
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
            className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-[#152f2a]"
          >
            Reset Password
          </button>
          {resetPasswordMessage && (
            <p className="mt-3 text-sm text-slate-600">{resetPasswordMessage}</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Danger Zone</h2>
          <p className="text-sm text-slate-600 mb-4">
            Delete your account and all associated data. This action cannot be undone.
          </p>
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={deleteConfirmed}
              onChange={(e) => setDeleteConfirmed(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-slate-600">
              I understand this will delete my account and all my data
            </span>
          </label>
          <button
            onClick={handleDeleteAccount}
            disabled={!deleteConfirmed}
            className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Account
          </button>
          {deleteAccountMessage && (
            <p className="mt-3 text-sm text-slate-600">{deleteAccountMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
