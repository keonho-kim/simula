/**
 * Purpose: Align page content and context headers within the shared workspace width.
 * Pattern: Presentation composition.
 * Usage: Used by working pages and editorial report headers.
 * Related: src/ui/styles/workspace.css
 */
import type { ReactNode } from "react"
import { cn } from "@/ui/lib/class-names"

export function WorkspaceFrame({ children, className, ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  return <main aria-label={ariaLabel} className={cn("workspace-page", className)}><div className="workspace-frame">{children}</div></main>
}

export function WorkspaceHeader({ title, description, navigation, actions, eyebrow }: {
  title: string; description?: string; navigation?: ReactNode; actions?: ReactNode; eyebrow?: string
}) {
  return <header className="workspace-header">
    {navigation}
    <div className="min-w-0 flex-1">{eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>{description ? <p className="workspace-description">{description}</p> : null}
    </div>
    {actions ? <div className="workspace-actions">{actions}</div> : null}
  </header>
}
