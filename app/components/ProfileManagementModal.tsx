"use client";

import { useState } from "react";
import { User } from "firebase/auth";
import { 
  UserProfileData, 
  updateUserProfile, 
  compressImageToDataUrl, 
  checkUsernameAvailable, 
  claimUsername, 
  updateUserPasswordInAuth 
} from "@/lib/user-profile";

interface ProfileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  profile: UserProfileData;
  onProfileUpdated: (updated: UserProfileData) => void;
}

export function ProfileManagementModal({
  isOpen,
  onClose,
  currentUser,
  profile,
  onProfileUpdated,
}: ProfileManagementModalProps) {
  const [name, setName] = useState(profile.name || "");
  const [username, setUsername] = useState(profile.username || "");
  const [favSong, setFavSong] = useState(profile.favSong || "");
  const [photoURL, setPhotoURL] = useState(profile.photoURL || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, WebP).");
      return;
    }

    try {
      setUploadingPhoto(true);
      setError("");
      const compressedDataUrl = await compressImageToDataUrl(file);
      setPhotoURL(compressedDataUrl);
    } catch (err) {
      console.error(err);
      setError("Could not process image. Try a smaller image.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      setSaving(false);
      return;
    }

    try {
      // 1. If username changed, check availability & claim
      if (cleanUsername !== profile.username) {
        const isAvailable = await checkUsernameAvailable(cleanUsername, profile.uid);
        if (!isAvailable) {
          setError(`@${cleanUsername} is already taken by someone else.`);
          setSaving(false);
          return;
        }
        await claimUsername(cleanUsername, profile.uid);
      }

      // 2. If password change requested
      if (newPassword) {
        if (newPassword.length < 6) {
          setError("New password must be at least 6 characters.");
          setSaving(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setError("Passwords do not match.");
          setSaving(false);
          return;
        }
        await updateUserPasswordInAuth(currentUser, newPassword);
      }

      // 3. Save updates in Firestore & local cache
      const updates: Partial<UserProfileData> = {
        name: name.trim() || cleanUsername,
        username: cleanUsername,
        favSong: favSong.trim(),
        photoURL,
      };

      try {
        await updateUserProfile(profile.uid, updates);
      } catch (firestoreErr) {
        console.warn("Could not sync profile to Firestore, saved locally:", firestoreErr);
      }

      const updatedProfile: UserProfileData = {
        ...profile,
        ...updates,
      };

      onProfileUpdated(updatedProfile);
      setSuccess("Profile updated successfully.");
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: unknown) {
      console.error(err);
      const errObj = err as { message?: string };
      setError(errObj.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="max-w-md w-full bg-[var(--pastel-card)] portfolio-panel p-6 sm:p-7 portfolio-shadow max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-[var(--pastel-border)]">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--pastel-text)] flex items-center gap-2">
              Edit Your Profile
            </h2>
            <p className="text-xs text-[var(--pastel-subtext)]">
              update your photo, favorite song, and credentials
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--pastel-tint)] text-[var(--pastel-text)] hover:opacity-80 transition-opacity flex items-center justify-center font-bold text-xs cursor-pointer"
            title="Close"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div
            className="mb-4 p-3 text-xs font-semibold rounded-2xl text-center"
            style={{
              backgroundColor: "var(--pastel-error-bg)",
              color: "var(--pastel-error-text)",
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="mb-4 p-3 text-xs font-semibold rounded-2xl text-center"
            style={{
              backgroundColor: "var(--pastel-success-bg)",
              color: "var(--pastel-success-text)",
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Profile Picture Upload */}
          <div className="flex items-center gap-4 p-3.5 bg-[var(--pastel-tint)] rounded-2xl">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--pastel-card)] flex items-center justify-center text-lg font-bold shrink-0 shadow-2xs" style={{ color: "var(--pastel-accent-text)" }}>
              {photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{name?.charAt(0)?.toUpperCase() || "U"}</span>
              )}
            </div>

            <div className="flex-1">
              <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1">
                Profile Photo
              </label>
              <div className="flex gap-2">
                <label className="cursor-pointer px-3.5 py-1.5 bg-[var(--pastel-card)] hover:opacity-90 text-[var(--pastel-text)] rounded-full text-xs font-bold transition-all shadow-2xs">
                  <span>{uploadingPhoto ? "Processing..." : "Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploadingPhoto}
                  />
                </label>
                {photoURL && (
                  <button
                    type="button"
                    onClick={() => setPhotoURL("")}
                    className="px-2.5 py-1.5 text-xs text-[var(--pastel-subtext)] hover:text-[var(--pastel-error-text)] font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              <span className="text-[10px] text-[var(--pastel-subtext)] mt-1 block">
                Square images work best! Automatically optimized.
              </span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] text-sm text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)]"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1">
              Username (@handle)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xs font-bold text-[var(--pastel-subtext)]">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="username"
                className="w-full pl-7 pr-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] text-sm text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)]"
                required
              />
            </div>
          </div>

          {/* Favorite Song / Soundtrack */}
          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1 flex items-center gap-1">
              Favorite Song / Soundtrack (Shown on your profile)
            </label>
            <input
              type="text"
              autoComplete="off"
              value={favSong}
              onChange={(e) => setFavSong(e.target.value)}
              placeholder="e.g. JVKE - Golden Hour (or Spotify link)"
              className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] text-sm text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)]"
            />
          </div>

          {/* Change Password (Optional) */}
          <div className="pt-2 border-t border-[var(--pastel-border)] space-y-3">
            <span className="text-xs font-bold text-[var(--pastel-text)] block">
              Change Password (optional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-xs text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)]"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-xs text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)]"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[var(--pastel-tint)] hover:opacity-85 text-[var(--pastel-text)] font-bold rounded-full text-xs transition-opacity cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] font-bold rounded-full text-xs transition-all portfolio-shadow disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
