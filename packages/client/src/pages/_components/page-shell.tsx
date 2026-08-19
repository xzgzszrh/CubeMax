import { SidebarTrigger } from "@buildingai/ui/components/ui/sidebar";
import { cn } from "@buildingai/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PageShellProps = {
  icon: LucideIcon;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared shell for host applications. Keeping the header and content rhythm in
 * one place makes the app center, programming tools and classroom utilities
 * feel like parts of the same product while leaving each page's data layer
 * independent.
 */
export function PageShell({
  icon: Icon,
  eyebrow = "CubeCat Studio",
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <div className="bg-muted/20 h-full overflow-y-auto">
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col px-5 py-5 md:px-8 md:py-7",
          className,
        )}
      >
        <div className="-mx-2 -mt-1 mb-3 flex h-8 items-center md:hidden">
          <SidebarTrigger />
        </div>
        <header className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-foreground text-background mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg shadow-xs">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide">
                {eyebrow}
              </div>
              <h1 className="text-2xl leading-tight font-semibold tracking-tight md:text-[1.75rem]">
                {title}
              </h1>
              {description ? (
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-5">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
              {actions}
            </div>
          ) : null}
        </header>
        <div className={cn("pt-6", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
