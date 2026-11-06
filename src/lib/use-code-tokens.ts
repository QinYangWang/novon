"use client";

import * as React from "react"
import { createCodeStream, highlightTokens, type CodeTokenLines } from "@/lib/highlight"

export function useCodeTokens(code: string, language: string, streaming = false): CodeTokenLines | null {
  const [result, setResult] = React.useState<{ language: string; lines: CodeTokenLines } | null>(null)
  const session = React.useRef<{
    language: string
    source: string
    stream: Awaited<ReturnType<typeof createCodeStream>>
  } | null>(null)
  const queue = React.useRef(Promise.resolve())

  React.useEffect(() => {
    let cancelled = false
    queue.current = queue.current.then(async () => {
      if (cancelled) return
      if (!streaming) {
        const current = session.current
        const lines = current && current.language === language && code.startsWith(current.source)
          ? await current.stream.update(code, true)
          : await highlightTokens(code, language)
        current?.stream.dispose()
        session.current = null
        if (!cancelled) setResult({ language, lines })
        return
      }
      let current = session.current
      if (!current || current.language !== language || !code.startsWith(current.source)) {
        current?.stream.dispose()
        const stream = await createCodeStream(language)
        if (cancelled) { stream.dispose(); return }
        current = { language, source: "", stream }
        session.current = current
      }
      const lines = await current.stream.update(code)
      current.source = code
      if (!cancelled) setResult({ language, lines })
    }).catch(() => {
      session.current?.stream.dispose()
      session.current = null
    })
    return () => { cancelled = true }
  }, [code, language, streaming])

  React.useEffect(() => () => {
    session.current?.stream.dispose()
    session.current = null
  }, [])
  return result?.language === language ? result.lines : null
}
