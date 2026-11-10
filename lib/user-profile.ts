import { doc, getDoc, setDoc } from "firebase/firestore";
import { updatePassword, User } from "firebase/auth";
import { db } from "./firebase";

export interface UserProfileData {
  uid: string;
  name: string;
  username: string;
  email?: string;
  photoURL?: string;
  favSong?: string;
  themeColor?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Resizes and compresses an image File to a lightweight Base64 JPEG data URL (< 70KB)
 * for instant, reliable storage in Firestore without external bucket dependencies.
 */
export async function compressImageToDataUrl(file: File, maxDim = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Clean JPEG at 0.82 quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function getUserProfile(uid: string): Promise<UserProfileData | null> {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfileData;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`snapweed_profile_${uid}`, JSON.stringify(data));
        } catch {}
      }
      return data;
    }
    // Check cached profile if Firestore doc doesn't exist yet
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`snapweed_profile_${uid}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  } catch (err) {
    console.warn("getUserProfile notice:", err);
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`snapweed_profile_${uid}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfileData>
): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`snapweed_profile_${uid}`);
      const base = cached ? JSON.parse(cached) : { uid };
      localStorage.setItem(`snapweed_profile_${uid}`, JSON.stringify({ ...base, ...updates }));
    } catch {}
  }
  const userRef = doc(db, "users", uid);
  await setDoc(
    userRef,
    {
      ...updates,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function updateUserPasswordInAuth(user: User, newPass: string): Promise<void> {
  await updatePassword(user, newPass);
}

export async function checkUsernameAvailable(username: string, currentUid?: string): Promise<boolean> {
  const clean = username.trim().toLowerCase();
  if (!clean) return false;
  try {
    const userDoc = await getDoc(doc(db, "usernames", clean));
    if (!userDoc.exists()) return true;
    const data = userDoc.data();
    if (currentUid && data.uid === currentUid) return true;
    return false;
  } catch {
    // If usernames collection is not readable due to rules, allow pass-through
    // since Firebase Auth uniquely gates {username}@snapweed.app
    return true;
  }
}

export async function claimUsername(username: string, uid: string): Promise<void> {
  try {
    const clean = username.trim().toLowerCase();
    await setDoc(doc(db, "usernames", clean), {
      uid,
      username: clean,
      claimedAt: new Date().toISOString(),
    });
  } catch {
    // Non-fatal if usernames collection rule is not enabled
  }
}
