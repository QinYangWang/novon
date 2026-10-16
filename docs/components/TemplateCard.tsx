import * as React from 'react'
import { Button, icons, useBase } from 'novon'

/** A starter template: its screenshot, what it's for and a link to its live demo. */
export default function TemplateCard({ name, title, children }: { name: string; title: string; children?: React.ReactNode }) {
  const base = useBase()
  const demo = base(`/templates/${name}/`)
  return (
    <div className="not-typeset my-6 overflow-hidden rounded-2xl bg-card shadow-raised">
      <a href={demo} aria-label={`${title} demo`} className="group block bg-muted px-4 pt-4 sm:px-8 sm:pt-8">
        <img
          src={base(`/templates/${name}.webp`)}
          alt=""
          width={1280}
          height={800}
          loading="lazy"
          className="block w-full rounded-t-lg shadow-raised transition-transform duration-200 group-hover:-translate-y-0.5 dark:hidden"
        />
        <img
          src={base(`/templates/${name}-dark.webp`)}
          alt=""
          width={1280}
          height={800}
          loading="lazy"
          className="hidden w-full rounded-t-lg shadow-raised transition-transform duration-200 group-hover:-translate-y-0.5 dark:block"
        />
      </a>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-semibold text-foreground">{title}</p>
          <div className="text-ui text-muted-foreground [&_p]:m-0">{children}</div>
          <code className="mt-1 self-start rounded-md bg-muted px-2 py-1 font-mono text-ui-sm text-foreground">novon new my-site --template {name}</code>
        </div>
        <Button className="shrink-0 self-start sm:self-center" nativeButton={false} render={<a href={demo} />}>
          Live demo
          <icons.ArrowUpRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}
