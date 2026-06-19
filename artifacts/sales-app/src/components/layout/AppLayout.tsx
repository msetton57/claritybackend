import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  BookImage,
  Boxes,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DatabaseZap,
  FolderOpen,
  LayoutDashboard,
  PlusCircle,
  Receipt,
  ShoppingCart,
  CircleCheckBig,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/users";
import { useLogout } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { GlobalSearch } from "./GlobalSearch";

interface AppLayoutProps {
  children: React.ReactNode;
  fluid?: boolean;
  scrollContent?: boolean;
  headerContent?: React.ReactNode;
  headerActions?: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  activePaths?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function AppLayout({ children, fluid = false, scrollContent = true, headerContent, headerActions }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: currentUser, error, isLoading } = useCurrentUser();
  const logoutMutation = useLogout();
  const userName = currentUser?.name ?? "Clarity User";
  const userInitials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      setLocation("/login");
      return;
    }

    if (currentUser?.passwordResetRequired && location !== "/setup-password") {
      setLocation("/setup-password");
    }
  }, [currentUser?.passwordResetRequired, error, location, setLocation]);

  const navItems: NavSection[] = [
    {
      title: "Reports",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/reports/customers", label: "Customer Revenue", icon: Users },
        {
          href: "/reports",
          label: "Reports",
          icon: CalendarRange,
          activePaths: [
            "/reports",
            "/reports/revenue",
            "/reports/yoy",
            "/reports/mom",
          ],
        },
        { href: "/ar", label: "A/R Aging", icon: Receipt },
      ],
    },
    {
      title: "CRM",
      items: [
        { href: "/sales-workspace", label: "Sales Workspace", icon: ClipboardList },
        {
          href: "/customers",
          label: "Customer Hub",
          icon: Users,
          activePaths: ["/customers"],
        },
      ],
    },
    {
      title: "Products",
      items: [{ href: "/catalog", label: "Catalog", icon: BookImage }],
    },
    {
      title: "Operations",
      items: [
        { href: "/workspace", label: "Shared Files", icon: FolderOpen },
        { href: "/supply", label: "Supply Management", icon: Boxes },
        { href: "/imports", label: "Data Imports", icon: DatabaseZap },
        { href: "/tasks", label: "Tasks", icon: CircleCheckBig },
        { href: "/board", label: "Poster Board", icon: Bell },
      ],
    },
    {
      title: "Orders",
      items: [
        {
          href: "/orders",
          label: "All Orders",
          icon: ShoppingCart,
          exact: true,
        },
        { href: "/orders/new", label: "New Order", icon: PlusCircle },
      ],
    },
    ...(currentUser?.role === "admin"
      ? [
          {
            title: "Administration",
            items: [
              {
                href: "/admin/users",
                label: "User Management",
                icon: ShieldCheck,
              },
            ],
          },
        ]
      : []),
  ];

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    setLocation("/login");
  }

  if (isLoading || (error instanceof ApiError && error.status === 401)) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden h-full shrink-0 overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex md:flex-col",
          collapsed ? "w-[84px]" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground",
            collapsed ? "justify-center px-3" : "justify-between px-5",
          )}
        >
          {!collapsed ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-lg font-semibold uppercase tracking-[0.32em]">
                Clarity
              </div>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 border border-white/10 text-sidebar-primary-foreground hover:bg-white/10"
            onClick={() => setCollapsed((current) => !current)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>

        <div
          className={cn(
            "flex-1 overflow-y-auto py-6",
            collapsed ? "px-2" : "px-4",
          )}
        >
          <div className="space-y-8">
            {navItems.map((section) => (
              <div key={section.title}>
                {!collapsed ? (
                  <h3 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                    {section.title}
                  </h3>
                ) : null}
                <nav className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = item.activePaths
                      ? item.activePaths.some(
                          (path) =>
                            location === path ||
                            location.startsWith(`${path}/`),
                        )
                      : item.exact
                        ? location === item.href
                        : location.startsWith(item.href);
                    return (
                      <Link key={item.href} href={item.href}>
                        <span
                          title={item.label}
                          className={cn(
                            "flex cursor-pointer items-center rounded-md text-sm transition-colors",
                            collapsed
                              ? "justify-center px-2 py-3"
                              : "gap-3 px-3 py-2",
                            isActive
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive ? "text-sidebar-primary" : "",
                            )}
                          />
                          {!collapsed ? item.label : null}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "border-t border-sidebar-border p-4",
            collapsed && "px-2",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              collapsed ? "justify-center" : "gap-3 px-2 py-2",
            )}
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">
              {userInitials}
            </div>
            {!collapsed ? (
              <div className="text-sm">
                <div className="font-medium">{userName}</div>
                <div className="text-xs text-sidebar-foreground/50">
                  {currentUser?.title ?? "Main Administrator"}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 text-left text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/50 hover:text-sidebar-foreground"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f4f7fb_100%)]">
        <div className="relative z-[1200] border-b border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
          <div
            className={cn(
              "relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
              fluid ? "mx-0 w-full max-w-none" : "mx-auto max-w-[1400px]",
            )}
          >
            {headerContent ? <div className="min-w-0 flex-1">{headerContent}</div> : null}
            <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[34rem] md:flex-row md:items-center md:justify-end">
              <GlobalSearch />
              {headerActions ? <div className="flex flex-wrap justify-end gap-3">{headerActions}</div> : null}
            </div>
          </div>
        </div>
        <div className={cn("flex-1 min-h-0", scrollContent ? "overflow-y-auto" : "overflow-hidden")}>
          <div
            className={cn(
              "p-4 md:p-6",
              scrollContent ? "" : "flex h-full min-h-0 flex-col",
              fluid ? "mx-auto w-full max-w-none" : "mx-auto max-w-7xl",
            )}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
