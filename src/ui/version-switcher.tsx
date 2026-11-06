"use client";

import * as React from "react"

import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { useLocale } from "@/ui/locale-provider"
import { Menu, MenuContent, MenuGroup, MenuLabel, MenuLinkItem, MenuTrigger } from "@/ui/menu"
import { CheckIcon, ChevronsUpDownIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/*
 * The docs version picker at the top of a sidebar. Each version is a link,
 * with an optional tag.
 *
 *   <VersionSwitcher
 *     value="v2"
 *     versions={[
 *       { value: "v2", label: "v2", href: "/docs", tag: "latest" },
 *       { value: "v1", label: "v1", href: "/v1/docs", tag: "archived" },
 *     ]}
 *   />
 */

type VersionTag = "latest" | "beta" | "archived"

type VersionOption = {
  /** Identifies the option; matched against the switcher's `value`. */
  value: string
  label: string
  href: string
  /** `latest`, `beta` and `archived` are labelled from the locale; any other text shows as written. */
  tag?: VersionTag | (string & {})
}

type VersionSwitcherProps = Omit<React.ComponentProps<"button">, "value" | "onSelect"> & {
  versions: readonly VersionOption[]
  /** Value of the version being read. */
  value: string
  /** `compact`: content width at the small height, for a header. `default` fills its container, as in a sidebar. */
  size?: "default" | "compact"
  /** Called before the link is followed. Call `event.preventDefault()` to route on the client. */
  onSelect?: (version: VersionOption, event: React.MouseEvent<HTMLAnchorElement>) => void
}

const TAG_VARIANT: Record<VersionTag, "success" | "primary" | "outline"> = {
  latest: "success",
  beta: "primary",
  archived: "outline",
}

function VersionTagBadge({ tag }: { tag: string }) {
  const { labels } = useLocale()
  const known: Record<VersionTag, string> = {
    latest: labels.versionLatest,
    beta: labels.versionBeta,
    archived: labels.versionArchived,
  }
  const preset = tag in known ? (tag as VersionTag) : undefined
  return (
    <Badge data-tag={tag} size="sm" variant={preset ? TAG_VARIANT[preset] : "chip"}>
      {preset ? known[preset] : tag}
    </Badge>
  )
}

function VersionSwitcher({ versions, value, size = "default", onSelect, className, ...props }: VersionSwitcherProps) {
  const { labels } = useLocale()
  const current = versions.find((v) => v.value === value) ?? versions[0]
  if (!current) return null
  return (
    <>
      <Menu>
        <MenuTrigger
          data-slot="version-switcher"
          data-size={size}
          aria-label={labels.versionCurrent(current.label)}
          render={<Button variant="secondary" size={size === "compact" ? "sm" : "default"} />}
          className={cn("justify-between font-normal", size === "default" && "w-full", className)}
          {...props}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-muted-foreground">{labels.version}</span>
            <span className="truncate font-medium">{current.label}</span>
          </span>
          <ChevronsUpDownIcon data-icon="inline-end" className="size-3.5 text-muted-foreground" />
        </MenuTrigger>
        <MenuContent align="start" className={size === "compact" ? "min-w-[max(var(--anchor-width),10rem)]" : "min-w-(--anchor-width)"}>
          <MenuGroup>
            <MenuLabel className="sr-only">{labels.version}</MenuLabel>
            {versions.map((v) => {
              const active = v.value === current.value
              return (
                <MenuLinkItem
                  key={v.value}
                  href={v.href}
                  aria-current={active ? "page" : undefined}
                  closeOnClick
                  inset
                  onClick={onSelect ? (e: React.MouseEvent<HTMLAnchorElement>) => onSelect(v, e) : undefined}
                >
                  {active && (
                    <span className="absolute start-2 flex size-4 items-center justify-center">
                      <CheckIcon className="text-primary-text!" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{v.label}</span>
                  {v.tag && <VersionTagBadge tag={v.tag} />}
                </MenuLinkItem>
              )
            })}
          </MenuGroup>
        </MenuContent>
      </Menu>
      {/* Without scripts the menu can't open; the same links show as a list instead. */}
      <noscript>
        <span data-slot="version-switcher-fallback" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui">
          <span className="text-muted-foreground">{labels.version}</span>
          {versions.map((v) => (
            <a
              key={v.value}
              href={v.href}
              aria-current={v.value === current.value ? "page" : undefined}
              className="text-muted-foreground hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {v.label}
            </a>
          ))}
        </span>
        <style>{`[data-slot="version-switcher"]{display:none}`}</style>
      </noscript>
    </>
  )
}

export { VersionSwitcher, VersionTagBadge }
export type { VersionOption, VersionSwitcherProps, VersionTag }
