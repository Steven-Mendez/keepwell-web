"use client"

import { useEffect } from "react"

import { requestPersistentStorage } from "@/lib/platform/persistent-storage"
import { categoryRepository } from "@/lib/repositories"

/**
 * Work that must happen once per launch before data is shown: keep IndexedDB from being evicted and
 * seed the shipped categories (iOS seeds them on its first fetch).
 */
export function AppBootstrap() {
  useEffect(() => {
    void requestPersistentStorage()
    void categoryRepository.ensureDefaults()
  }, [])
  return null
}
