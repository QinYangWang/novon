/**
 * Read aloud: the `listen` page action speaks the page's blocks one by one
 * with the browser's speech synthesis, marks the block being read, and shows a
 * media bar (pause, skip, stop, progress). Escape or leaving the page stops it.
 * Hidden where speech synthesis is missing.
 */
import * as React from 'react'
import { MediaBar, markSpeaking } from '@/ui/media-bar'
import { useSite } from './site.tsx'

type State = 'idle' | 'playing' | 'paused'

const BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, dt, dd, td, th, figcaption'
const SKIP = 'pre, code, [data-novon-chrome], [data-slot="code-block"], [data-novon], nav, aside, [aria-hidden="true"]'

let state: State = 'idle'
let queue: HTMLElement[] = []
let index = 0
let run = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const set = (s: State) => {
  state = s
  emit()
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

/** The page's readable blocks in order: the innermost matching elements with text, outside code and chrome. */
export function readableBlocks(root: ParentNode): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(BLOCKS))
  return all.filter((el) => !el.closest(SKIP) && !el.querySelector(BLOCKS) && (el.textContent ?? '').trim().length > 0)
}

const mark = (el: HTMLElement | undefined) => markSpeaking(el ?? null)

function speakNext(ticket: number) {
  if (ticket !== run) return
  const el = queue[index]
  if (!el) return stopReading()
  mark(el)
  const u = new SpeechSynthesisUtterance((el.innerText || el.textContent || '').trim())
  u.lang = document.documentElement.lang || 'en'
  u.onend = () => {
    if (ticket !== run) return
    index++
    speakNext(ticket)
  }
  u.onerror = (e) => {
    if (ticket === run && e.error !== 'interrupted' && e.error !== 'canceled') stopReading()
  }
  speechSynthesis.speak(u)
}

export function startReading(root: ParentNode | null = document.querySelector('article.typeset')) {
  if (!speechSupported() || !root) return
  speechSynthesis.cancel()
  queue = readableBlocks(root)
  index = 0
  if (!queue.length) return
  const ticket = ++run
  set('playing')
  speakNext(ticket)
}

export function pauseReading() {
  if (state !== 'playing') return
  speechSynthesis.pause()
  set('paused')
}

export function resumeReading() {
  if (state !== 'paused') return
  speechSynthesis.resume()
  set('playing')
}

/** Jumps to the previous or next block and reads on from there. */
export function skipReading(by: number) {
  if (state === 'idle' || !queue.length) return
  index = Math.max(0, Math.min(queue.length - 1, index + by))
  speechSynthesis.cancel()
  if (state === 'paused') speechSynthesis.resume()
  const ticket = ++run
  set('playing')
  speakNext(ticket)
}

/** The block being read, from 1, and how many there are. */
export function readingProgress(): { current: number; total: number } {
  return { current: Math.min(index + 1, queue.length), total: queue.length }
}

export function stopReading() {
  run++
  if (speechSupported()) speechSynthesis.cancel()
  queue = []
  mark(undefined)
  if (state !== 'idle') set('idle')
}

export function useReading(): State {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => 'idle',
  )
}

/** Whether to offer read aloud: false on the server and where speech synthesis is missing. */
export function useSpeechSupported(): boolean {
  const [ok, setOk] = React.useState(false)
  React.useEffect(() => setOk(speechSupported()), [])
  return ok
}

/** The bar shown while reading: play/pause, skip, stop and progress. */
export function ReadAloudBar() {
  const reading = useReading()
  const { current } = useSite()
  React.useEffect(() => stopReading, [current.route])
  React.useEffect(() => {
    if (reading === 'idle') return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stopReading()
    const onLeave = () => stopReading()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pagehide', onLeave)
    }
  }, [reading])
  if (reading === 'idle') return null
  const progress = readingProgress()
  return (
    <MediaBar
      data-novon-chrome=""
      playing={reading === 'playing'}
      onPlayingChange={(play) => (play ? resumeReading() : pauseReading())}
      onSkipBack={() => skipReading(-1)}
      onSkipForward={() => skipReading(1)}
      onStop={stopReading}
      current={progress.current}
      total={progress.total}
      order={0}
    />
  )
}
