import React from "react";
import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  CalendarDays, 
  CalendarRange, 
  Users, 
  ShoppingCart, 
  PlusCircle, 
  Receipt,
  LayoutDashboard
} from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    {
      title: "Reports",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/reports/yoy", label: "Year over Year", icon: CalendarRange },
        { href: "/reports/mom", label: "Month over Month", icon: CalendarDays },
        { href: "/ar", label: "A/R Aging", icon: Receipt },
      ]
    },
    {
      title: "Orders",
      items: [
        { href: "/orders", label: "All Orders", icon: ShoppingCart, exact: true },
        { href: "/orders/new", label: "New Order", icon: PlusCircle },
      ]
    }
  ];

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex-shrink-0 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground">
          <div className="font-bold text-lg tracking-tight flex items-center gap-2">
            <BarChart3 className="size-5" />
            <span>Sales & Orders</span>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-8 overflow-y-auto">
          {navItems.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-sidebar-foreground/50 mb-3 px-2">
                {section.title}
              </h3>
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.exact ? location === item.href : location.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href}>
                      <span className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }`}>
                        <item.icon className={`size-4 ${isActive ? "text-sidebar-primary" : ""}`} />
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary font-bold text-xs">
              JS
            </div>
            <div className="text-sm">
              <div className="font-medium">Jane Smith</div>
              <div className="text-sidebar-foreground/50 text-xs">VP of Sales</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-muted/20">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
