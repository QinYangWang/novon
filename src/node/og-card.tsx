/**
 * TEMPORARY: novon's stand-in social card, until the library's `og-image`
 * registry item lands. Then this file is deleted and `og.ts` renders that
 * component with the same props.
 *
 * Rendered by satori at build time, so: inline styles and flexbox only, no CSS
 * variables, no classes, no browser APIs. Colours arrive as resolved theme
 * tokens (see `readTokens` in og.ts); nothing here is a raw colour.
 */
import type { OgTokens } from './og.ts'

export interface OgCardProps {
  title: string
  description?: string
  siteName: string
  /** Data URI of the site logo or the author's avatar. */
  image?: string
  /** Round the image (an avatar) or keep it square (a logo). */
  imageShape?: 'circle' | 'square'
  author?: string
  date?: string
  tags?: string[]
  tokens: OgTokens
}

/** Shorter titles get bigger type. CJK characters count double. */
function titleSize(title: string): number {
  const width = [...title].reduce((n, c) => n + (/[\u2e80-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(c) ? 2 : 1), 0)
  if (width <= 28) return 76
  if (width <= 48) return 64
  if (width <= 80) return 54
  return 46
}

export function OgCard({ title, description, siteName, image, imageShape = 'square', author, date, tags = [], tokens: t }: OgCardProps) {
  const size = titleSize(title)
  const meta = [author, date].filter(Boolean).join(' · ')
  const footer = Boolean(meta || tags.length)
  // 630 - 128 padding - 56 header - 72 footer: yoga does not shrink text boxes.
  const body = 630 - 128 - 56 - (footer ? 72 : 0)
  return (
    <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: t.background, color: t.foreground, padding: '64px 72px', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, background: t.primary, display: 'flex' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {image && <img src={image} width={56} height={56} style={{ width: 56, height: 56, borderRadius: imageShape === 'circle' ? 28 : 12, objectFit: 'cover' }} />}
        <div style={{ fontSize: 30, fontWeight: 700, color: t.mutedForeground, display: 'flex' }}>{siteName}</div>
      </div>
      <div style={{ height: body, width: 1056, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, overflow: 'hidden' }}>
        <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5, lineClamp: 3, display: 'block', width: 1056 }}>{title}</div>
        {description && <div style={{ fontSize: 30, lineHeight: 1.45, color: t.mutedForeground, lineClamp: 2, display: 'block', width: 1056 }}>{description}</div>}
      </div>
      {footer && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderTop: `2px solid ${t.border}`, paddingTop: 24, height: 72, width: 1056 }}>
          <div style={{ fontSize: 26, color: t.mutedForeground, display: 'flex' }}>{meta}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {tags.slice(0, 3).map((tag) => (
              <div key={tag} style={{ fontSize: 22, color: t.primary, background: t.primarySubtle, borderRadius: 999, padding: '6px 18px', display: 'flex' }}>#{tag}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
