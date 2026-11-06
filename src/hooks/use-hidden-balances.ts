"use client"

import { useSyncExternalStore } from "react"

/** What a hidden amount shows, everywhere (iOS `visible(_:hidden:)`). */
export const BALANCE_MASK = "••••"

const HIDE_KEY = "keepwell.hidesBalances"
const HIDE_EVENT = "keepwell:hide-balances"

function subscribe(onChange: () => void) {
  window.addEventListener(HIDE_EVENT, onChange)
  // Another tab toggling it changes this one too.
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(HIDE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function read(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * iOS's eye button (`@AppStorage("home.hidesBalances")`): balances masked on every screen that
 * shows them, remembered on this device.
 */
export function useHiddenBalances(): [boolean, () => void] {
  const hidden = useSyncExternalStore(subscribe, read, () => false)
  const toggle = () => {
    try {
      localStorage.setItem(HIDE_KEY, hidden ? "0" : "1")
    } catch {}
    window.dispatchEvent(new Event(HIDE_EVENT))
  }
  return [hidden, toggle]
}
