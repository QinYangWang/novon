"use client";

import * as React from "react"

import { Button } from "@/ui/button"
import { useLocale } from "@/ui/locale-provider"
import { Menu, MenuContent, MenuGroup, MenuLabel, MenuLinkItem, MenuTrigger } from "@/ui/menu"
import { CheckIcon, GlobeIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/*
 * The header control that lists a site's languages. Each option is a link to
 * the same page in that language, labelled in its own language.
 *
 *   <LocaleSwitcher
 *     value="en"
 *     locales={[
 *       { code: "en", label: "English", href: "/docs" },
 *       { code: "ja", label: "日本語", href: "/ja/docs" },
 *     ]}
 *   />
 */

type LocaleOption = {
  /** Identifies the option; matched against `value`. */
  code: string
  /** The language's name in that language ("Deutsch", "日本語"). */
  label: string
  href: string
  /** BCP 47 tag for `lang` and `hreflang`. Defaults to `code`. */
  lang?: string
  /** Writing direction of the label. */
  dir?: "ltr" | "rtl"
}

type LocaleSwitcherProps = Omit<React.ComponentProps<"button">, "value" | "onSelect"> & {
  locales: readonly LocaleOption[]
  /** Code of the current language. */
  value: string
  /** `icon` shows only the globe, for phone headers. */
  size?: "default" | "icon"
  /** Popup alignment to the trigger, in the reading direction. */
  align?: "start" | "center" | "end"
  /** Called before the link is followed. Call `event.preventDefault()` to route on the client. */
  onSelect?: (locale: LocaleOption, event: React.MouseEvent<HTMLAnchorElement>) => void
}

function LocaleSwitcher({
  locales,
  value,
  size = "default",
  align = "end",
  onSelect,
  className,
  ...props
}: LocaleSwitcherProps) {
  const { labels } = useLocale()
  const current = locales.find((l) => l.code === value) ?? locales[0]
  if (!current) return null
  const tag = (l: LocaleOption) => l.lang ?? l.code
  return (
    <>
      <Menu>
        <MenuTrigger
          data-slot="locale-switcher"
          data-size={size}
          aria-label={labels.languageCurrent(current.label)}
          render={<Button variant="ghost" size={size === "icon" ? "icon-sm" : "sm"} />}
          className={cn(size === "default" && "text-muted-foreground aria-expanded:text-foreground hover:text-foreground", className)}
          {...props}
        >
          <GlobeIcon data-icon={size === "default" ? "inline-start" : undefined} />
          {size === "default" && (
            <span lang={tag(current)} dir={current.dir}>
              {current.label}
            </span>
          )}
        </MenuTrigger>
        <MenuContent align={align} className="min-w-40">
          <MenuGroup>
            <MenuLabel>{labels.language}</MenuLabel>
            {locales.map((l) => {
              const active = l.code === current.code
              return (
                <MenuLinkItem
                  key={l.code}
                  href={l.href}
                  hrefLang={tag(l)}
                  lang={tag(l)}
                  aria-current={active ? "page" : undefined}
                  closeOnClick
                  inset
                  onClick={onSelect ? (e: React.MouseEvent<HTMLAnchorElement>) => onSelect(l, e) : undefined}
                >
                  {active && (
                    <span className="absolute start-2 flex size-4 items-center justify-center">
                      <CheckIcon className="text-primary-text!" />
                    </span>
                  )}
                  <span dir={l.dir}>{l.label}</span>
                </MenuLinkItem>
              )
            })}
          </MenuGroup>
        </MenuContent>
      </Menu>
      {/* Without scripts the menu can't open; the same links show inline instead. */}
      <noscript>
        <span data-slot="locale-switcher-fallback" className="inline-flex items-center gap-3 text-ui">
          {locales.map((l) => (
            <a
              key={l.code}
              href={l.href}
              hrefLang={tag(l)}
              lang={tag(l)}
              dir={l.dir}
              aria-current={l.code === current.code ? "page" : undefined}
              className="text-muted-foreground hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </span>
        <style>{`[data-slot="locale-switcher"]{display:none}`}</style>
      </noscript>
    </>
  )
}

export { LocaleSwitcher }
export type { LocaleOption, LocaleSwitcherProps }
