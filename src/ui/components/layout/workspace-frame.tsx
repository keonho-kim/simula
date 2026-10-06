/**
 * Purpose: Align page content and separate navigation controls from workspace or editorial titles.
 * Pattern: Presentation composition.
 * Usage: Used by working pages and editorial report headers.
 * Related: src/ui/styles/workspace.css
 */
import type { ReactNode, Ref } from "react"
import { cn } from "@/ui/lib/class-names"

export function WorkspaceFrame({ children, className, ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  return <main aria-label={ariaLabel} className={cn("workspace-page", className)}><div className="workspace-frame">{children}</div></main>
}

export function WorkspaceHeader({ title, description, navigation, actions, eyebrow, metadata, headingRef, appearance = "workspace" }: {
  title: string; description?: string; navigation?: ReactNode; actions?: ReactNode; eyebrow?: string
  metadata?: ReactNode; headingRef?: Ref<HTMLHeadingElement>; appearance?: "workspace" | "editorial"
}) {
  return <header className="workspace-header" data-appearance={appearance}>
    {navigation || actions ? <div className="workspace-toolbar">{navigation}
      {actions ? <div className="workspace-actions">{actions}</div> : null}
    </div> : null}
    <div className="workspace-heading">{eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
      <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h1>
      {description ? <p className="workspace-description">{description}</p> : null}
      {metadata ? <div className="workspace-metadata">{metadata}</div> : null}
    </div>
  </header>
}
