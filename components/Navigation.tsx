"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserMenu } from "./user-menu";
import { Home, FileSpreadsheet, Users, BarChart3 } from "lucide-react";
import { usePathname } from "next/navigation";

export function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) {
    return null;
  }

  // Since we removed role-based access, all authorized users have access
  const isAdmin = true; // All users have admin access for now

  // Build navigation items - order matters for active state detection
  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
    },
  ];

  // Add admin route first (more specific route)
  if (isAdmin) {
    navItems.push({
      name: "User Management",
      href: "/mls-processor/admin",
      icon: Users,
    });
  }

  // Add other routes after more specific ones
  navItems.push(
    {
      name: "MLS Processor",
      href: "/mls-processor",
      icon: FileSpreadsheet,
    },
    {
      name: "Reports",
      href: "/reports",
      icon: BarChart3,
    }
  );

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link
                href="/dashboard"
                className="text-2xl font-bold text-blue-600"
              >
                🌍 MLS System
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                // More precise active state logic
                const isActive = (() => {
                  if (pathname === item.href) {
                    return true;
                  }

                  // Special case for dashboard - only exact match
                  if (item.href === "/dashboard") {
                    return pathname === "/dashboard";
                  }

                  // For other routes, check if pathname starts with the href
                  // but make sure we don't have false positives
                  if (pathname.startsWith(item.href)) {
                    // Check if there's a more specific route that should take precedence
                    const moreSpecificRoute = navItems.find(
                      (navItem) =>
                        navItem.href !== item.href &&
                        navItem.href.startsWith(item.href) &&
                        pathname.startsWith(navItem.href)
                    );
                    return !moreSpecificRoute;
                  }

                  return false;
                })();

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center">
            <UserMenu />
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="sm:hidden pb-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              // Same precise active state logic for mobile
              const isActive = (() => {
                if (pathname === item.href) {
                  return true;
                }

                // Special case for dashboard - only exact match
                if (item.href === "/dashboard") {
                  return pathname === "/dashboard";
                }

                // For other routes, check if pathname starts with the href
                // but make sure we don't have false positives
                if (pathname.startsWith(item.href)) {
                  // Check if there's a more specific route that should take precedence
                  const moreSpecificRoute = navItems.find(
                    (navItem) =>
                      navItem.href !== item.href &&
                      navItem.href.startsWith(item.href) &&
                      pathname.startsWith(navItem.href)
                  );
                  return !moreSpecificRoute;
                }

                return false;
              })();

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
