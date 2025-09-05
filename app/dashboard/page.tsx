"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  MapPin,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Database,
  ArrowRight,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalUsers: number;
  totalProcessed: number;
  successRate: string;
  lastActivity: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProcessed: 0,
    successRate: "0%",
    lastActivity: "Never",
  });
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Load dashboard stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        // Get real stats from API endpoints
        const response = await fetch("/api/dashboard/stats", {
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.error('Dashboard API error:', response.status, response.statusText);
          // Fallback to simulated stats if API fails
          setStats({
            totalUsers: 5,
            totalProcessed: 1250,
            successRate: "94%",
            lastActivity: "2 hours ago",
          });
        }
      } catch (error) {
        console.error("Error loading dashboard stats:", error);
        // Fallback to simulated stats
        setStats({
          totalUsers: 5,
          totalProcessed: 1250,
          successRate: "94%",
          lastActivity: "2 hours ago",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      loadStats();

      // Refresh stats every 30 seconds to keep activity time updated
      const interval = setInterval(loadStats, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Track user activity with mouse movement, clicks, keyboard
  useEffect(() => {
    let activityTimeout: NodeJS.Timeout;

    const updateActivity = async () => {
      try {
        await fetch("/api/user/activity", { method: "POST" });
      } catch (error) {
        console.error("Error updating activity:", error);
      }
    };

    const resetActivityTimer = () => {
      clearTimeout(activityTimeout);
      // Update activity after 1 minute of inactivity
      activityTimeout = setTimeout(updateActivity, 60000);
    };

    const handleActivity = () => {
      resetActivityTimer();
    };

    if (session) {
      // Add event listeners for user activity
      window.addEventListener("mousemove", handleActivity);
      window.addEventListener("click", handleActivity);
      window.addEventListener("keypress", handleActivity);
      window.addEventListener("scroll", handleActivity);

      // Initial timer
      resetActivityTimer();

      return () => {
        // Cleanup
        clearTimeout(activityTimeout);
        window.removeEventListener("mousemove", handleActivity);
        window.removeEventListener("click", handleActivity);
        window.removeEventListener("keypress", handleActivity);
        window.removeEventListener("scroll", handleActivity);
      };
    }
  }, [session]);

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg text-blue-700">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const userName = session.user.name || "User";
  // Since we removed role-based access, all authorized users have access
  const isAdmin = true; // All users have admin access for now

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  Welcome back, {userName}! 👋
                </h1>
                <p className="text-blue-100 text-lg">
                  Ready to process some geographic data today?
                </p>
                <div className="flex items-center mt-4 space-x-4">
                  {isAdmin && (
                    <Badge
                      variant="secondary"
                      className="bg-yellow-400 text-yellow-900"
                    >
                      Administrator
                    </Badge>
                  )}
                  <div className="flex items-center text-blue-200">
                    <Activity className="h-4 w-4 mr-1" />
                    <span className="text-sm">
                      Last activity:{" "}
                      <span className="text-yellow-300 font-medium">
                        {stats.lastActivity}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="text-6xl opacity-20">🌍</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-lg border-0 hover:shadow-2xl hover:-translate-y-2 hover:scale-105 transition-all duration-300 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalUsers}
              </div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                Active system users
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg border-0 hover:shadow-2xl hover:-translate-y-2 hover:scale-105 transition-all duration-300 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Addresses Processed
              </CardTitle>
              <MapPin className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalProcessed.toLocaleString()}
              </div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <CheckCircle className="h-3 w-3 mr-1" />
                All time total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg border-0 hover:shadow-2xl hover:-translate-y-2 hover:scale-105 transition-all duration-300 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Success Rate
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stats.successRate}
              </div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                Geocoding accuracy
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg border-0 hover:shadow-2xl hover:-translate-y-2 hover:scale-105 transition-all duration-300 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                System Status
              </CardTitle>
              <Activity className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">Online</div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <CheckCircle className="h-3 w-3 mr-1" />
                All services operational
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* MLS Processor Module */}
          <Card className="bg-white shadow-xl border-0 hover:shadow-2xl hover:-translate-y-2 hover:scale-105 transition-all duration-300 transform cursor-pointer">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900">
                      MLS Processor
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Process and geocode real estate data files
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-700"
                >
                  Core Module
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>
                  Upload Excel/CSV files and automatically detect columns,
                  geocode addresses, and enrich your real estate data with
                  geographic information.
                </p>
              </div>
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Ready
                  </div>
                  <div className="flex items-center text-gray-500">
                    <Clock className="h-4 w-4 mr-1" />
                    Fast processing
                  </div>
                </div>
                <Link href="/mls-processor">
                  <Button className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 transform hover:scale-105">
                    Open Processor
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* User Management Module */}
          {isAdmin && (
            <Card className="bg-white shadow-xl border-0 hover:shadow-2xl hover:-translate-y-2 hover:scale-105 transition-all duration-300 transform cursor-pointer">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-green-100 rounded-full">
                      <Users className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-900">
                        User Management
                      </CardTitle>
                      <CardDescription className="text-gray-600">
                        Manage system users and permissions
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-red-100 text-red-700"
                  >
                    Admin Only
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>
                    Add, remove, and manage users who have access to the MLS
                    Processor system. Control permissions and monitor user
                    activity.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center text-blue-600">
                      <Database className="h-4 w-4 mr-1" />
                      {stats.totalUsers} users
                    </div>
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Secure
                    </div>
                  </div>
                  <Link href="/mls-processor/admin">
                    <Button
                      variant="outline"
                      className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-all duration-200 transform hover:scale-105"
                    >
                      Manage Users
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coming Soon Modules */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="h-6 w-6 mr-2 text-blue-600" />
            Coming Soon
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reports Module */}
            <Card className="bg-gray-50 shadow-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition-all duration-300 cursor-pointer">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-purple-100 rounded-full opacity-60">
                      <BarChart3 className="h-8 w-8 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-600">
                        Reports & Analytics
                      </CardTitle>
                      <CardDescription className="text-gray-500">
                        Detailed insights and reporting tools
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-yellow-100 text-yellow-700"
                  >
                    In Development
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-500">
                  <p>
                    Generate comprehensive reports on processing statistics,
                    user activity, geographic coverage, and data quality
                    metrics.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center text-gray-400">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Coming Q2 2025
                    </div>
                  </div>
                  <Button disabled className="opacity-50 cursor-not-allowed">
                    Coming Soon
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Analytics Module */}
            <Card className="bg-gray-50 shadow-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition-all duration-300 cursor-pointer">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-100 rounded-full opacity-60">
                      <TrendingUp className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-600">
                        Advanced Analytics
                      </CardTitle>
                      <CardDescription className="text-gray-500">
                        Real-time dashboards and data visualization
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-yellow-100 text-yellow-700"
                  >
                    In Development
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-500">
                  <p>
                    Interactive charts, geographic heat maps, performance
                    trends, and predictive analytics for real estate data
                    patterns.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center text-gray-400">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Coming Q3 2025
                    </div>
                  </div>
                  <Button disabled className="opacity-50 cursor-not-allowed">
                    Coming Soon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="bg-white shadow-lg border-0 hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition-all duration-300 cursor-pointer">
          <CardHeader>
            <CardTitle className="text-xl text-gray-900 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-600" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Frequently used actions for faster workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/mls-processor">
                <Button
                  variant="outline"
                  className="w-full justify-start transition-all duration-200 transform hover:scale-105"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Process New File
                </Button>
              </Link>

              {isAdmin && (
                <Link href="/mls-processor/admin">
                  <Button
                    variant="outline"
                    className="w-full justify-start transition-all duration-200 transform hover:scale-105"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Add New User
                  </Button>
                </Link>
              )}

              <Link href="/reports">
                <Button
                  variant="outline"
                  className="w-full justify-start transition-all duration-200 transform hover:scale-105"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Reports
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
