"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Users, UserPlus, Mail } from "lucide-react";

const userSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name must contain only letters and spaces")
    .transform((val) =>
      val
        .trim()
        .split(" ")
        .filter((word) => word.length > 0) // Remove empty strings
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    ),
});

type UserForm = z.infer<typeof userSchema>;

interface User {
  id: string;
  email: string;
  name: string;
  last_login: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{
    id: string;
    email: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
  });

  // Function to capitalize names in real time
  const capitalizeName = (name: string): string => {
    return name
      .split(' ')
      .map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(' ');
  };

  // Watch the name field for real-time capitalization
  const nameValue = watch("name");

  // Handle name input change with real-time capitalization
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only capitalize if user is typing (not deleting)
    if (value.length > (nameValue?.length || 0)) {
      const lastChar = value.slice(-1);
      if (lastChar === ' ' || value.split(' ').length > (nameValue?.split(' ').length || 0)) {
        setValue("name", capitalizeName(value));
      } else {
        setValue("name", value);
      }
    } else {
      setValue("name", value);
    }
  };

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Auto-hide success messages after 6 seconds
  useEffect(() => {
    if (message && message.type === "success") {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        setMessage({
          type: "error",
          text: "Error loading users",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Connection error loading users",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const onSubmit = async (data: UserForm) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "User added successfully!",
        });
        reset();
        loadUsers(); // Reload users list
      } else {
        setMessage({
          type: "error",
          text: result.error || "Error adding user",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Connection error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "User removed successfully!",
        });
        loadUsers(); // Reload users list
        setShowDeleteModal(false);
        setUserToDelete(null);
      } else {
        const result = await response.json();
        setMessage({
          type: "error",
          text: result.error || "Error removing user",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Connection error. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      deleteUser(userToDelete.id);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
    setIsDeleting(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2 justify-center md:justify-start">
          <Users className="h-8 w-8 text-blue-600" />
          User Administration
        </h1>
        <p className="text-gray-600">
          Manage authorized users who can access the MLS Processor system
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Add User Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              Add New User
            </CardTitle>
            <CardDescription>
              Grant access to new users by adding their email and name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  disabled={isLoading}
                  {...register("email")}
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  disabled={isLoading}
                  {...register("name", {
                    onChange: handleNameChange
                  })}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {message && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    message.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <Button
                type="submit"
                className="w-full transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Adding User...
                  </div>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Authorized Users ({users.length})
            </CardTitle>
            <CardDescription>
              Currently authorized users with system access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 truncate">
                          {user.name}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          Admin
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {user.email}
                      </p>
                      <p className="text-xs text-gray-400">
                        Added: {formatDate(user.created_at)}
                      </p>
                      {user.last_login && (
                        <p className="text-xs text-green-600">
                          Last login: {formatDate(user.last_login)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(user)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl relative border-l-4 border-red-500">
            {/* Close X button */}
            <button
              onClick={handleDeleteCancel}
              className="absolute top-3 right-3 bg-gray-500 hover:bg-gray-600 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer shadow-lg"
              title="Close dialog"
              disabled={isDeleting}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🗑️</div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">
                Remove User Access
              </h2>
              <p className="text-gray-600">
                Are you sure you want to remove access for this user?
              </p>
            </div>

            <div className="bg-red-50 rounded-lg p-4 mb-6 border border-red-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-700">Name:</span>
                <span className="text-red-600 font-bold">
                  {userToDelete.name}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-700">Email:</span>
                <span className="text-red-600 font-bold">
                  {userToDelete.email}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700">Action:</span>
                <span className="text-red-600 font-bold">REVOKE ACCESS</span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-yellow-600 mr-3 mt-0.5">⚠️</div>
                <div>
                  <p className="text-yellow-800 font-medium mb-1">Warning:</p>
                  <p className="text-yellow-700 text-sm">
                    This user will no longer be able to access the MLS Processor
                    system. This action can be reversed by adding the user
                    again.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isDeleting ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Removing Access...
                  </div>
                ) : (
                  <>🗑️ Remove User Access</>
                )}
              </button>

              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="w-full bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
