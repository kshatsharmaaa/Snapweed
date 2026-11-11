"use client";

import { useSyncExternalStore } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface UserPhotoDirectory {
  byUid: Record<string, string>;
  byHandle: Record<string, string>;
}

const EMPTY_DIRECTORY: UserPhotoDirectory = { byUid: {}, byHandle: {} };
let currentDirectory: UserPhotoDirectory = EMPTY_DIRECTORY;
let subscriberCount = 0;
let firestoreUnsub: (() => void) | null = null;
const listeners = new Set<() => void>();

export function normalizeUserKey(value?: string): string {
  return (value || "").trim().replace(/^@+/, "").toLowerCase();
}

function emitDirectoryChange() {
  listeners.forEach((listener) => listener());
}

function startDirectoryListener() {
  if (firestoreUnsub || typeof window === "undefined") return;
  try {
    firestoreUnsub = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const nextByUid: Record<string, string> = {};
        const nameEntries: Record<string, string> = {};
        const usernameEntries: Record<string, string> = {};

        snapshot.docs.forEach((d) => {
          const data = d.data() as {
            photoURL?: string;
            name?: string;
            username?: string;
          };
          const photo = typeof data.photoURL === "string" ? data.photoURL.trim() : "";
          nextByUid[d.id] = photo;

          if (photo) {
            const normName = normalizeUserKey(data.name);
            const normUsername = normalizeUserKey(data.username);
            if (normName && !nameEntries[normName]) {
              nameEntries[normName] = photo;
            }
            if (normUsername) {
              usernameEntries[normUsername] = photo;
            }
          }
        });

        currentDirectory = {
          byUid: nextByUid,
          byHandle: { ...nameEntries, ...usernameEntries },
        };
        emitDirectoryChange();
      },
      () => {
        // Non-fatal if offline or restricted; callers fall back to post-embedded photos
      }
    );
  } catch {
    firestoreUnsub = null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  subscriberCount += 1;
  if (subscriberCount === 1) {
    startDirectoryListener();
  }

  return () => {
    listeners.delete(listener);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0 && firestoreUnsub) {
      firestoreUnsub();
      firestoreUnsub = null;
    }
  };
}

function getSnapshot(): UserPhotoDirectory {
  return currentDirectory;
}

function getServerSnapshot(): UserPhotoDirectory {
  return EMPTY_DIRECTORY;
}

/** Subscribes to live `users` profile photos for avatar resolution across feeds. */
export function useUserPhotoDirectory(): UserPhotoDirectory {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export interface ResolveAuthorPhotoOptions {
  authorId?: string;
  authorPhoto?: string;
  authorName?: string;
  authorUsername?: string;
  currentUid?: string;
  currentPhoto?: string;
  currentName?: string;
  currentUsername?: string;
}

/** Resolves the best live profile photo for a post, answer, song, or suggestion author. */
export function resolveAuthorPhoto(
  dir: UserPhotoDirectory,
  {
    authorId,
    authorPhoto,
    authorName,
    authorUsername,
    currentUid,
    currentPhoto,
    currentName,
    currentUsername,
  }: ResolveAuthorPhotoOptions
): string {
  if (currentUid && authorId && authorId === currentUid && currentPhoto) {
    return currentPhoto;
  }

  if (authorId && Object.prototype.hasOwnProperty.call(dir.byUid, authorId)) {
    return dir.byUid[authorId];
  }

  if (authorPhoto) {
    return authorPhoto;
  }

  const keyUser = normalizeUserKey(authorUsername);
  const keyName = normalizeUserKey(authorName);

  if (!authorId && currentPhoto) {
    const curUser = normalizeUserKey(currentUsername);
    const curName = normalizeUserKey(currentName);
    if ((keyName && keyName === curName) || (keyUser && keyUser === curUser) || (keyName && keyName === curUser)) {
      return currentPhoto;
    }
  }

  if (keyUser && dir.byHandle[keyUser]) return dir.byHandle[keyUser];
  if (keyName && dir.byHandle[keyName]) return dir.byHandle[keyName];
  return "";
}
