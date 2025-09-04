"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  LogOut,
  Home,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const userInitials =
    session.user.email?.split("@")[0].substring(0, 2).toUpperCase() || "AD";

  const userName = session.user.name || "MLS Admin";
  // Since we removed role-based access, all authorized users have access
  const isAdmin = true; // All users have admin access for now

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-100 text-blue-600">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <div className="flex flex-col space-y-1 p-2">
          <p className="text-sm font-medium leading-none">{userName}</p>
          <p className="text-xs leading-none text-muted-foreground">
            {session.user.email}
          </p>
          {isAdmin && (
            <div className="pt-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                Administrator
              </span>
            </div>
          )}
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="cursor-pointer">
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/mls-processor" className="cursor-pointer">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            MLS Processor
          </Link>
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/mls-processor/admin" className="cursor-pointer">
              <Users className="mr-2 h-4 w-4" />
              User Management
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled className="text-gray-400 cursor-not-allowed">
          <BarChart3 className="mr-2 h-4 w-4" />
          Reports (Coming Soon)
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="text-gray-400 cursor-not-allowed">
          <TrendingUp className="mr-2 h-4 w-4" />
          Analytics (Coming Soon)
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
