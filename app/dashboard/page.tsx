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
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2" aria-hidden="true">
            <span className="portfolio-dot" />
            <span className="portfolio-dot" />
            <span className="portfolio-dot" />
          </div>
          <span className="text-xs font-bold tracking-wide uppercase">loading snapweed...</span>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  const activeThemeId = currentTheme || profile.themeColor || DEFAULT_THEME_ID;
  const activeThemeMeta = PASTEL_THEMES[activeThemeId] || PASTEL_THEMES[DEFAULT_THEME_ID];

  return (
    <div 
      className="min-h-screen pb-20 transition-colors duration-300"
      style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-text)" }}
    >
      
      {/* Clean Borderless Frosted Nav */}
      <nav 
        className="backdrop-blur-md sticky top-0 z-30 transition-colors"
        style={{ backgroundColor: "var(--pastel-nav)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          
          {/* Wordmark + subtle portfolio tri-pastel dot */}
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--pastel-primary)" }} aria-hidden="true" />
            <span className="text-xl font-extrabold tracking-tight" style={{ color: "var(--pastel-text)" }}>
              snapweed
            </span>
          </div>

          {/* Toggle, Notifications, Profile & Sign out */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
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
              className="flex items-center gap-2 p-1 pr-3 rounded-full hover:opacity-90 transition-all text-xs font-bold portfolio-shadow cursor-pointer"
              style={{ 
                backgroundColor: "var(--pastel-card)", 
                color: "var(--pastel-text)"
              }}
              title="Edit Profile"
            >
              <div 
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: "var(--pastel-tint)", color: "var(--pastel-accent-text)" }}
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
                <span className="text-[10px] font-medium" style={{ color: "var(--pastel-subtext)" }}>
                  @{profile.username}
                </span>
              </div>
            </button>

            <button
              onClick={handleSignOut}
              className="text-xs font-bold px-2.5 py-1.5 rounded-full transition-opacity hover:opacity-75 cursor-pointer"
              style={{ color: "var(--pastel-subtext)" }}
            >
              Sign out
            </button>
          </div>

        </div>
      </nav>

      {/* Main Content — Open Editorial Flow directly on Pastel Canvas */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-10">
        
        {/* Hero Greeting & Minimalist Floating Palette Swatches (No outer box!) */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="h-1 w-7 rounded-full" style={{ backgroundColor: "var(--portfolio-pink)" }} />
              <span className="h-1 w-7 rounded-full" style={{ backgroundColor: "var(--portfolio-green)" }} />
              <span className="h-1 w-7 rounded-full" style={{ backgroundColor: "var(--portfolio-blue)" }} />
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                Hey, {profile.name}
              </h1>
              <p className="text-xs sm:text-sm font-medium mt-1" style={{ color: "var(--pastel-subtext)" }}>
                @{profile.username}
              </p>
            </div>

            {profile.favSong && (
              <div className="pt-0.5">
                <FavoriteSongBanner
                  favSong={profile.favSong}
                  onChangeClick={() => setShowProfileModal(true)}
                />
              </div>
            )}
          </div>

          {/* Minimalist Pastel Swatch Bar (Borderless floating pill) */}
          <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
            <span className="text-[11px] font-bold px-1" style={{ color: "var(--pastel-subtext)" }}>
              Theme: <span style={{ color: "var(--pastel-accent-text)" }}>{activeThemeMeta.name}</span>
            </span>
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--pastel-card)] portfolio-shadow">
              {Object.values(PASTEL_THEMES).map((th) => {
                const isActive = activeThemeId === th.id;
                const palette = getPastelPalette(th.id, activeMode);
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleSelectPastelTheme(th.id)}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                      isActive
                        ? "scale-115 ring-2 ring-[var(--pastel-text)] ring-offset-2 ring-offset-[var(--pastel-card)]"
                        : "opacity-75 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{
                      backgroundColor: palette.primary,
                    }}
                    title={th.name}
                    aria-label={`Switch theme to ${th.name}`}
                    aria-pressed={isActive}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* Room Error Notice */}
        {roomError && (
          <div
            className="p-3.5 text-xs font-bold rounded-2xl text-center portfolio-shadow"
            style={{
              backgroundColor: "var(--pastel-error-bg)",
              color: "var(--pastel-error-text)",
            }}
          >
            {roomError}
          </div>
        )}

        {/* SECTION 1: Chat Rooms */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Create Room Panel — Borderless Portfolio Curve */}
            <div className="bg-[var(--pastel-card)] portfolio-panel p-6 sm:p-7 portfolio-shadow flex flex-col justify-between space-y-5 transition-all">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-1 w-8 rounded-full" style={{ backgroundColor: "var(--portfolio-pink)" }} aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--pastel-subtext)" }}>
                    Host
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-[var(--pastel-text)] tracking-tight">
                  Create a Chat Room
                </h3>
                <p className="text-xs text-[var(--pastel-subtext)] mt-1.5 leading-relaxed">
                  Generate an instant 6-digit room code to share with a friend or group.
                </p>

                {/* Optional Room Password */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordInput(!showPasswordInput)}
                    className="text-[11px] font-bold hover:underline cursor-pointer"
                    style={{ color: "var(--pastel-accent-text)" }}
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
                      className="mt-2.5 w-full px-4 py-2.5 text-xs rounded-2xl bg-[var(--pastel-input)] text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
                    />
                  )}
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="w-full py-3 bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] font-bold rounded-full text-xs transition-all portfolio-shadow disabled:opacity-50 cursor-pointer"
              >
                {isCreating ? "Creating Room..." : "Create Room"}
              </button>
            </div>

            {/* Join Room Panel — Borderless Portfolio Curve */}
            <div className="bg-[var(--pastel-card)] portfolio-panel p-6 sm:p-7 portfolio-shadow flex flex-col justify-between space-y-5 transition-all">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-1 w-8 rounded-full" style={{ backgroundColor: "var(--portfolio-green)" }} aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--pastel-subtext)" }}>
                    Join
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-[var(--pastel-text)] tracking-tight">
                  Join a Chat Room
                </h3>
                <p className="text-xs text-[var(--pastel-subtext)] mt-1.5 leading-relaxed">
                  Enter your friend&apos;s 6-digit code to jump straight into the chat.
                </p>

                <form id="join-room-form" onSubmit={handleJoinRoom} className="mt-4 space-y-2.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="000000"
                    className="w-full py-2.5 px-4 text-center text-lg font-mono tracking-[0.4em] rounded-2xl bg-[var(--pastel-input)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] font-bold text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] transition-all"
                    required
                  />

                  <input
                    type="password"
                    autoComplete="off"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Password (if room is protected)"
                    className="w-full px-4 py-2.5 text-xs rounded-2xl bg-[var(--pastel-input)] text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
                  />
                </form>
              </div>

              <button
                type="submit"
                form="join-room-form"
                disabled={isJoining || joinCode.length !== 6}
                className={`w-full py-3 font-bold rounded-full text-xs transition-all cursor-pointer ${
                  joinCode.length === 6 && !isJoining
                    ? "bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] portfolio-shadow"
                    : "bg-[var(--pastel-tint)] text-[var(--pastel-subtext)] opacity-80 cursor-not-allowed"
                }`}
              >
                {isJoining ? "Joining Room..." : "Join Chat Room"}
              </button>
            </div>

          </div>
        </section>

        {/* SECTION 2: Community Feed */}
        <section id="community-board" className="space-y-5 pt-2">
          
          <div className="flex items-center justify-between gap-4">
            {/* Borderless Floating Pill Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1.5 bg-[var(--pastel-card)] rounded-full portfolio-shadow w-fit">
              <button
                onClick={() => setCommunityTab("questions")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  communityTab === "questions"
                    ? "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] shadow-2xs"
                    : "text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
                }`}
              >
                Questions
              </button>
              <button
                onClick={() => setCommunityTab("blogs")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  communityTab === "blogs"
                    ? "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] shadow-2xs"
                    : "text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
                }`}
              >
                Logs &amp; Blogs
              </button>
              <button
                onClick={() => setCommunityTab("songs")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  communityTab === "songs"
                    ? "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] shadow-2xs"
                    : "text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
                }`}
              >
                Soundtrack
              </button>
              <button
                onClick={() => setCommunityTab("feedback")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  communityTab === "feedback"
                    ? "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] shadow-2xs"
                    : "text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
                }`}
              >
                Feedback
              </button>
            </div>
          </div>

          {/* Active Tab View (Un-nested directly on canvas!) */}
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
            <FeedbackBoard
              currentUid={user.uid}
              currentName={profile.name || profile.username}
              currentUsername={profile.username}
              currentPhoto={profile.photoURL}
            />
          )}

        </section>

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
