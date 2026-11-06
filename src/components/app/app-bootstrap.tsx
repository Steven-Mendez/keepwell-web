"use client"

import { useEffect } from "react"

import { normalizeBankCards } from "@/lib/domain"
import { requestPersistentStorage } from "@/lib/platform/persistent-storage"
import { categoryRepository, ledgerStore } from "@/lib/repositories"

/**
 * Work that must happen once per launch before data is shown: keep IndexedDB from being evicted,
 * seed the shipped categories (iOS seeds them on its first fetch) and bring bank accounts to "one
 * account, one card" (iOS `NormalizeBankCardsUseCase` on launch).
 */
export function AppBootstrap() {
  useEffect(() => {
    void requestPersistentStorage()
    void categoryRepository.ensureDefaults().then(() => normalizeBankCards(ledgerStore))
  }, [])
  return null
}
