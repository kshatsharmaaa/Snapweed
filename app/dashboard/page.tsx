"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { 
  doc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { 
  UserProfileData, 
  getUserProfile, 
  updateUserProfile 
} from "@/lib/user-profile";
import {
  PASTEL_THEMES,
  applyPastelTheme,
  getPastelPalette,
  getStoredPastelTheme,
  getStoredThemeMode,
  DEFAULT_THEME_ID,
} from "@/lib/pastel-themes";
import { useStoredThemeMode } from "@/lib/usePastelTheme";
import { ProfileManagementModal } from "@/app/components/ProfileManagementModal";
import { QuestionsBoard } from "@/app/components/QuestionsBoard";
import { BlogsBoard } from "@/app/components/BlogsBoard";
import { SongsBoard } from "@/app/components/SongsBoard";
import { FeedbackBoard } from "@/app/components/FeedbackBoard";
import { NotificationBell } from "@/app/components/NotificationBell";
import { FavoriteSongBanner } from "@/app/components/TrackCover";
import { ThemeModeToggle } from "@/app/components/ThemeModeToggle";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [currentTheme, setCurrentTheme] = useState<string>(DEFAULT_THEME_ID);
  const activeMode = useStoredThemeMode();
  const [loading, setLoading] = useState(true);

  // Active Community Sub-view: "questions" | "blogs" | "songs" | "feedback"
  const [communityTab, setCommunityTab] = useState<"questions" | "blogs" | "songs" | "feedback">("questions");

  // Room creation / join state
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [createRoomPassword, setCreateRoomPassword] = useState("");
  const [roomError, setRoomError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  // Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);

  const router = useRouter();

  // Sync client query tab & stored theme/mode cleanly post-hydration
  useEffect(() => {
    const syncTimer = setTimeout(() => {
      const stored = getStoredPastelTheme();
      const storedMode = getStoredThemeMode();
      setCurrentTheme(stored);
      applyPastelTheme(stored, storedMode);

      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "blogs" || t === "songs" || t === "questions" || t === "feedback") {
        setCommunityTab(t);
      }
    }, 0);
    return () => clearTimeout(syncTimer);
  }, []);

  // Load User & Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const stored = getStoredPastelTheme();
        const storedMode = getStoredThemeMode();
        const data = await getUserProfile(currentUser.uid);
        if (data) {
          setProfile(data);
          const chosen = data.themeColor || stored || DEFAULT_THEME_ID;
          const prefMode =
            typeof data.darkMode === "boolean"
              ? data.darkMode
                ? "dark"
                : "light"
              : storedMode;
          setCurrentTheme(chosen);
          applyPastelTheme(chosen, prefMode);
        } else {
          // Fallback initial profile
          const fallbackUsername = currentUser.email?.split("@")[0] || "friend";
          const chosen = stored || DEFAULT_THEME_ID;
          const initProfile: UserProfileData = {
            uid: currentUser.uid,
            username: fallbackUsername,
            name: fallbackUsername,
            themeColor: chosen,
            darkMode: storedMode === "dark",
          };
          setProfile(initProfile);
          setCurrentTheme(chosen);
          applyPastelTheme(chosen, storedMode);
        }
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleSelectPastelTheme = async (themeKey: string) => {
    setCurrentTheme(themeKey);
    applyPastelTheme(themeKey, activeMode);
    setProfile((prev) => (prev ? { ...prev, themeColor: themeKey } : null));

    if (user) {
      try {
        await updateUserProfile(user.uid, { themeColor: themeKey });
      } catch (err) {
        console.error("Failed to save theme:", err);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  const handleCreateRoom = async () => {
    if (!user) return;
    setIsCreating(true);
    setRoomError("");

    try {
      // 6-digit room code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      const roomData: Record<string, unknown> = {
        securityCode: code,
        createdBy: user.uid,
        createdByName: profile?.name || profile?.username || "Host",
        status: "active",
        createdAt: serverTimestamp(),
        participants: [user.uid],
      };

      if (createRoomPassword.trim()) {
        roomData.roomPassword = createRoomPassword.trim();
      }

      const roomRef = await addDoc(collection(db, "rooms"), roomData);
      router.push(`/room/${roomRef.id}`);
    } catch (err: unknown) {
      console.error(err);
      setRoomError("Could not create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || joinCode.length !== 6) {
      setRoomError("Please enter a valid 6-digit room code.");
      return;
    }

    setIsJoining(true);
    setRoomError("");

    try {
      const q = query(
        collection(db, "rooms"), 
        where("securityCode", "==", joinCode),
        where("status", "==", "active")
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setRoomError("Room not found or no longer active.");
        setIsJoining(false);
        return;
      }

      const roomDoc = querySnapshot.docs[0];
      const data = roomDoc.data();

      // Check room password if configured
      if (data.roomPassword && data.createdBy !== user.uid) {
        if (joinPassword !== data.roomPassword) {
          setRoomError("Incorrect room password.");
          setIsJoining(false);
          return;
        }
      }

      await updateDoc(doc(db, "rooms", roomDoc.id), {
        participants: arrayUnion(user.uid)
      });

      router.push(`/room/${roomDoc.id}`);
    } catch (err: unknown) {
      console.error(err);
      setRoomError("Could not join room. Please check the code.");
    } finally {
      setIsJoining(false);
    }
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center transition-colors"
        style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-subtext)" }}
      >
        <div className="flex flex-col items-center gap-2">
          <div 
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--pastel-primary)", borderTopColor: "transparent" }}
          />
          <span className="text-xs font-bold">loading snapweed...</span>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  const activeThemeId = currentTheme || profile.themeColor || DEFAULT_THEME_ID;

  return (
    <div 
      className="min-h-screen pb-16 transition-colors duration-200"
      style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-text)" }}
    >
      
      {/* Top Friendly Nav */}
      <nav 
        className="backdrop-blur-md border-b sticky top-0 z-30 transition-colors"
        style={{ backgroundColor: "var(--pastel-nav)", borderColor: "var(--pastel-border)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight" style={{ color: "var(--pastel-text)" }}>
              snapweed
            </span>
          </div>

          {/* Notifications, Theme Mode, User info & Profile Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeModeToggle uid={user.uid} />

            <NotificationBell
              currentUid={user.uid}
              onNavigateTab={(tab) => {
                setCommunityTab(tab);
                const el = document.getElementById("community-board");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              onNavigateRoom={(roomId) => {
                router.push(`/room/${roomId}`);
              }}
            />

            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full border hover:opacity-90 transition-all text-xs font-bold shadow-2xs cursor-pointer"
              style={{ 
                backgroundColor: "var(--pastel-tint)", 
                borderColor: "var(--pastel-border)",
                color: "var(--pastel-text)"
              }}
              title="Edit Profile"
            >
              <div 
                className="w-7 h-7 rounded-full overflow-hidden bg-[var(--pastel-card)] border flex items-center justify-center text-xs font-bold shadow-2xs"
                style={{ borderColor: "var(--pastel-border)", color: "var(--pastel-primary)" }}
              >
                {profile.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{profile.name?.charAt(0)?.toUpperCase() || "U"}</span>
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="leading-tight">{profile.name}</span>
                <span className="text-[10px] font-semibold" style={{ color: "var(--pastel-subtext)" }}>
                  @{profile.username}
                </span>
              </div>
            </button>

            <button
              onClick={handleSignOut}
              className="text-xs font-bold px-2 py-1 rounded-xl transition-colors hover:opacity-80 cursor-pointer"
              style={{ color: "var(--pastel-subtext)" }}
            >
              Sign out
            </button>
          </div>

        </div>
      </nav>

      {/* Main Body */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Pastel Theme Selector Right on Top of the Screen */}
        <div 
          className="bg-[var(--pastel-card)] rounded-3xl p-5 border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
          style={{ borderColor: "var(--pastel-border)" }}
        >
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--pastel-text)" }}>
              Choose Your Pastel Theme
            </h2>
            <p className="text-xs" style={{ color: "var(--pastel-subtext)" }}>
              Pick one of our 6 curated colors &bull; saves directly to your profile
            </p>
          </div>

          {/* 6 Curated Pastel Buttons */}
          <div className="flex flex-wrap gap-2">
            {Object.values(PASTEL_THEMES).map((th) => {
              const isActive = activeThemeId === th.id;
              const palette = getPastelPalette(th.id, activeMode);
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => handleSelectPastelTheme(th.id)}
                  className={`px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-2xs border cursor-pointer ${
                    isActive
                      ? "ring-2 scale-105 shadow-xs"
                      : "opacity-80 hover:opacity-100 hover:scale-102"
                  }`}
                  style={{
                    backgroundColor: palette.tint,
                    borderColor: isActive ? palette.primary : palette.border,
                    color: palette.text,
                    outlineColor: palette.primary,
                  }}
                  title={th.name}
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: palette.primary }} 
                  />
                  <span>{th.name}</span>
                  {isActive && (
                    <span 
                      className="text-[9px] px-1 py-0.2 rounded-full font-bold text-white leading-tight"
                      style={{ backgroundColor: palette.primary }}
                    >
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Favorite Song Card (if user has set one) */}
        {profile.favSong && (
          <FavoriteSongBanner
            favSong={profile.favSong}
            onChangeClick={() => setShowProfileModal(true)}
          />
        )}

        {/* Room Error Banner */}
        {roomError && (
          <div
            className="p-3 text-xs font-bold rounded-2xl border text-center"
            style={{
              backgroundColor: "var(--pastel-error-bg)",
              color: "var(--pastel-error-text)",
              borderColor: "var(--pastel-error-border)",
            }}
          >
            {roomError}
          </div>
        )}

        {/* SECTION 1: Chat Rooms (Cozy, Clear, Non-Vague) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Create Room Card */}
          <div className="bg-[var(--pastel-card)] rounded-3xl p-6 border border-[var(--pastel-border)] shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div 
                className="w-10 h-10 rounded-2xl border flex items-center justify-center text-xs font-black tracking-wider uppercase mb-3 shadow-2xs"
                style={{ backgroundColor: "var(--pastel-tint)", borderColor: "var(--pastel-border)", color: "var(--pastel-primary)" }}
              >
                Room
              </div>
              <h3 className="text-base font-black text-[var(--pastel-text)]">
                Create a Chat Room
              </h3>
              <p className="text-xs text-[var(--pastel-subtext)] mt-1">
                Generate an instant real-time room code to share with a friend or group.
              </p>

              {/* Optional Room Password */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordInput(!showPasswordInput)}
                  className="text-[11px] font-bold text-[var(--pastel-primary)] hover:underline"
                >
                  {showPasswordInput ? "- Remove Password" : "+ Add Secret Room Password (Optional)"}
                </button>

                {showPasswordInput && (
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={createRoomPassword}
                    onChange={(e) => setCreateRoomPassword(e.target.value)}
                    placeholder="Enter optional password"
                    className="mt-2 w-full px-3 py-1.5 text-xs rounded-xl border border-[var(--pastel-border)] bg-[var(--pastel-bg)] text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)]"
                  />
                )}
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full py-3 bg-[var(--pastel-primary)] hover:opacity-90 text-white font-bold rounded-2xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? "Creating Room..." : "Create Room"}
            </button>
          </div>

          {/* Join Room Card */}
          <div className="bg-[var(--pastel-card)] rounded-3xl p-6 border border-[var(--pastel-border)] shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div 
                className="w-10 h-10 rounded-2xl border flex items-center justify-center text-xs font-black tracking-wider uppercase mb-3 shadow-2xs"
                style={{ backgroundColor: "var(--pastel-tint)", borderColor: "var(--pastel-border)", color: "var(--pastel-primary)" }}
              >
                Join
              </div>
              <h3 className="text-base font-black text-[var(--pastel-text)]">
                Join a Chat Room
              </h3>
              <p className="text-xs text-[var(--pastel-subtext)] mt-1">
                Enter your friend&apos;s 6-digit room code to jump straight into the chat.
              </p>

              <form onSubmit={handleJoinRoom} className="mt-3 space-y-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="000000"
                  className="w-full py-2.5 px-3 text-center text-2xl font-mono tracking-widest rounded-2xl border border-[var(--pastel-border)] bg-[var(--pastel-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] font-bold text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)]"
                  required
                />

                <input
                  type="password"
                  autoComplete="off"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="Password (if room is protected)"
                  className="w-full py-2 px-3 text-xs rounded-xl border border-[var(--pastel-border)] bg-[var(--pastel-bg)] text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)]"
                />

                <button
                  type="submit"
                  disabled={isJoining || joinCode.length !== 6}
                  className="w-full py-3 bg-[var(--pastel-primary)] hover:opacity-90 text-white font-bold rounded-2xl text-xs transition-all shadow-xs disabled:opacity-50"
                >
                  {isJoining ? "Joining Room..." : "Join Chat Room"}
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* SECTION 2: Community Board (Questions, Blogs, Song Recs, Feedback) */}
        <div id="community-board" className="space-y-4">
          
          {/* Sub-Tabs: Clean and Simple */}
          <div className="flex flex-wrap gap-2 p-1.5 bg-[var(--pastel-card)] rounded-2xl border border-[var(--pastel-border)] shadow-2xs w-fit">
            <button
              onClick={() => setCommunityTab("questions")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                communityTab === "questions"
                  ? "bg-[var(--pastel-primary)] text-white shadow-xs"
                  : "text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
              }`}
            >
              Questions for All
            </button>
            <button
              onClick={() => setCommunityTab("blogs")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                communityTab === "blogs"
                  ? "bg-[var(--pastel-primary)] text-white shadow-xs"
                  : "text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
              }`}
            >
              Personal Logs &amp; Blogs
            </button>
            <button
              onClick={() => setCommunityTab("songs")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                communityTab === "songs"
                  ? "bg-[var(--pastel-primary)] text-white shadow-xs"
                  : "text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
              }`}
            >
              Soundtrack &amp; Songs
            </button>
            <button
              onClick={() => setCommunityTab("feedback")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                communityTab === "feedback"
                  ? "bg-[var(--pastel-primary)] text-white shadow-xs"
                  : "text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
              }`}
            >
              Feedback &amp; Suggestions
            </button>
          </div>

          {/* Active Tab View */}
          {communityTab === "questions" && (
            <QuestionsBoard
              currentUid={user.uid}
              currentUsername={profile.username}
              currentName={profile.name}
              currentPhoto={profile.photoURL}
            />
          )}

          {communityTab === "blogs" && (
            <BlogsBoard
              currentUid={user.uid}
              currentUsername={profile.username}
              currentName={profile.name}
              currentPhoto={profile.photoURL}
            />
          )}

          {communityTab === "songs" && (
            <SongsBoard
              currentUid={user.uid}
              currentUsername={profile.username}
              currentName={profile.name}
              currentPhoto={profile.photoURL}
            />
          )}

          {communityTab === "feedback" && (
            <FeedbackBoard currentName={profile.name || profile.username} />
          )}

        </div>

      </main>

      {/* Profile Management Modal */}
      <ProfileManagementModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={user}
        profile={profile}
        onProfileUpdated={(updated) => setProfile(updated)}
      />

    </div>
  );
}
