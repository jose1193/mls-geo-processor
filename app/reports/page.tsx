"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  RefreshCw,
  FileText,
  Calendar,
  BarChart3,
  Users,
  Database,
  Clock,
  AlertCircle,
  Trash2,
  X,
} from "lucide-react";

// Define the interface locally to avoid dependency issues
interface CompletedFileRecord {
  id: string;
  user_id: string | null;
  original_filename: string;
  original_file_size: number | null;
  total_records: number;
  job_name: string | null;
  started_at: string;
  completed_at: string;
  processing_duration_ms: number | null;
  successful_records: number;
  failed_records: number;
  mapbox_requests: number;
  geocodio_requests: number;
  gemini_requests: number;
  cache_hits: number;
  storage_path: string;
  storage_url: string;
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

// Fetch function that handles errors gracefully
async function fetchCompletedFilesAPI(userId?: string | null): Promise<{
  success: boolean;
  files?: CompletedFileRecord[];
  error?: string;
}> {
  try {
    const params = new URLSearchParams();
    if (userId) {
      params.append("userId", userId);
    }

    const response = await fetch(`/api/reports/completed-files?${params}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, files: data.files || [] };
  } catch (error) {
    console.error("Error fetching completed files:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch files",
    };
  }
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const [completedFiles, setCompletedFiles] = useState<CompletedFileRecord[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<CompletedFileRecord | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Multiple selection state
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Fetch completed files
  const fetchCompletedFiles = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await fetchCompletedFilesAPI(session?.user?.id);

      if (result.success && result.files) {
        setCompletedFiles(result.files);
      } else {
        setError(result.error || "Failed to fetch reports");
      }
    } catch (err) {
      setError("Failed to fetch reports");
      console.error("Error fetching completed files:", err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchCompletedFiles();
    } else if (session === null) {
      // Session is loaded but user is not authenticated
      setError("Please log in to view reports");
      setIsLoading(false);
    }
  }, [session, fetchCompletedFiles]);

  // Delete functions
  const handleDeleteClick = (file: CompletedFileRecord) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    try {
      setIsDeleting(true);

      const response = await fetch(
        `/api/reports/completed-files/${fileToDelete.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        // Remove the deleted file from the list
        setCompletedFiles((files) =>
          files.filter((f) => f.id !== fileToDelete.id)
        );
        setShowDeleteModal(false);
        setFileToDelete(null);
      } else {
        setError(result.error || "Failed to delete file");
      }
    } catch (err) {
      setError("Failed to delete file");
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setFileToDelete(null);
  };

  // Bulk selection functions
  const handleSelectFile = (fileId: string) => {
    setSelectedFiles(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === completedFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(completedFiles.map(file => file.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedFiles.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedFiles.length === 0) return;

    setIsDeleting(true);
    try {
      const deletePromises = selectedFiles.map(async (fileId) => {
        const response = await fetch(`/api/reports/completed-files?id=${fileId}`, {
          method: "DELETE",
        });
        return response.ok;
      });

      const results = await Promise.all(deletePromises);
      const allSuccess = results.every(success => success);

      if (allSuccess) {
        await fetchCompletedFiles();
        setSelectedFiles([]);
        setShowBulkDeleteModal(false);
      } else {
        setError("Some files failed to delete");
      }
    } catch (err) {
      setError("Failed to delete files");
      console.error("Bulk delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteCancel = () => {
    setShowBulkDeleteModal(false);
  };

  // Format file size
  const formatFileSize = (file: CompletedFileRecord): string => {
    let bytes = file.file_size_bytes;

    if (!bytes && file.original_file_size) {
      bytes = file.original_file_size;
    }

    if (bytes && bytes > 0) {
      const mb = bytes / (1024 * 1024);
      if (mb < 1) {
        const kb = bytes / 1024;
        return `${kb.toFixed(1)} KB`;
      }
      return `${mb.toFixed(2)} MB`;
    }

    if (file.total_records) {
      const estimatedBytes = file.total_records * 150;
      const estimatedMB = estimatedBytes / (1024 * 1024);
      return `~${estimatedMB.toFixed(1)} MB`;
    }

    return "Size unavailable";
  };

  // Format duration
  const formatDuration = (durationMs: number | null): string => {
    if (!durationMs) return "N/A";

    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Calculate stats
  const stats = {
    totalFiles: completedFiles.length,
    totalRecords: completedFiles.reduce(
      (sum, file) => sum + file.total_records,
      0
    ),
    totalApiRequests: completedFiles.reduce(
      (sum, file) =>
        sum +
        file.mapbox_requests +
        file.geocodio_requests +
        file.gemini_requests,
      0
    ),
    avgSuccessRate:
      completedFiles.length > 0
        ? (
            (completedFiles.reduce(
              (sum, file) => sum + file.successful_records / file.total_records,
              0
            ) /
              completedFiles.length) *
            100
          ).toFixed(1)
        : "0",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl p-8 mb-8 text-center">
          <div className="inline-block bg-white/20 px-4 py-2 rounded-full text-sm mb-4">
            📊 Data Analytics
          </div>
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <BarChart3 className="h-10 w-10" />
            Processing Reports
          </h1>
          <p className="text-blue-100">
            Download and analyze your completed MLS processing reports
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Reports Dashboard
            </h2>
            <p className="text-gray-600">
              Manage and download your processing results
            </p>
          </div>
          <div className="flex gap-3">
            {selectedFiles.length > 0 && (
              <Button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedFiles.length})
              </Button>
            )}
            <Button
              onClick={fetchCompletedFiles}
              disabled={isLoading}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Reports
              </CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalFiles}
              </div>
              <p className="text-xs text-gray-500 mt-1">Completed files</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Records
              </CardTitle>
              <Database className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalRecords.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Properties processed</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                API Requests
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.totalApiRequests.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Total API calls</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Success Rate
              </CardTitle>
              <Users className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.avgSuccessRate}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Processing accuracy</p>
            </CardContent>
          </Card>
        </div>

        {/* Reports Table */}
        <Card className="bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Completed Processing Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600">Loading reports...</span>
              </div>
            ) : completedFiles.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No reports available
                </h3>
                <p className="text-gray-600">
                  Complete some MLS processing to see reports here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={selectedFiles.length === completedFiles.length && completedFiles.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all files"
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        File Name
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        Completed
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        Records
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        Success Rate
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        Duration
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        File Size
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        API Usage
                      </TableHead>
                      <TableHead className="text-center font-semibold">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedFiles.map((file) => {
                      const successRate = (
                        (file.successful_records / file.total_records) *
                        100
                      ).toFixed(1);

                      return (
                        <TableRow key={file.id} className="hover:bg-blue-50/50">
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedFiles.includes(file.id)}
                              onCheckedChange={() => handleSelectFile(file.id)}
                              aria-label={`Select ${file.original_filename}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <FileText className="h-4 w-4 text-blue-500" />
                              <div>
                                <div className="font-medium text-gray-900">
                                  {file.original_filename}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {file.job_name || "No job name"}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <div>
                                <div className="text-sm font-medium">
                                  {new Date(
                                    file.completed_at
                                  ).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(
                                    file.completed_at
                                  ).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="text-sm text-green-600 font-medium">
                              {file.successful_records.toLocaleString()}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Badge
                                variant={
                                  parseFloat(successRate) >= 90
                                    ? "default"
                                    : parseFloat(successRate) >= 70
                                      ? "secondary"
                                      : "destructive"
                                }
                                className="font-medium"
                              >
                                {successRate}%
                              </Badge>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {formatDuration(file.processing_duration_ms)}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <span className="text-sm font-medium">
                              {formatFileSize(file)}
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Mapbox:</span>
                                <span className="font-medium">
                                  {file.mapbox_requests}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Geocodio:</span>
                                <span className="font-medium">
                                  {file.geocodio_requests}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Gemini:</span>
                                <span className="font-medium">
                                  {file.gemini_requests}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-600">Cache:</span>
                                <span className="font-medium text-green-600">
                                  {file.cache_hits}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex gap-2 justify-center">
                              {file.storage_url ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="hover:bg-blue-50 border-blue-200 text-blue-600 p-2"
                                  title="Download file"
                                >
                                  <a
                                    href={file.storage_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              ) : (
                                <span className="text-gray-400 text-sm">
                                  No file
                                </span>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(file)}
                                className="hover:bg-red-50 border-red-200 text-red-600 p-2"
                                title="Delete file"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && fileToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-lg overflow-hidden shadow-xl">
            {/* Header rojo completamente arriba */}
            <div className="bg-red-600 text-white px-6 py-4">
              <div className="flex items-center gap-3">
                <Trash2 className="h-6 w-6" />
                <h3 className="text-xl font-semibold">Delete Report</h3>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Are you sure?</span>
                </div>
                <p className="text-sm">
                  This action cannot be undone. This will permanently delete the
                  file:
                </p>
                <p className="font-medium text-sm mt-2 break-all">
                  &ldquo;{fileToDelete.original_filename}&rdquo;
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    Records:{" "}
                    <span className="font-medium">
                      {fileToDelete.total_records.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    Completed:{" "}
                    <span className="font-medium">
                      {new Date(fileToDelete.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    Job:{" "}
                    <span className="font-medium">
                      {fileToDelete.job_name || "No job name"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete File
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && selectedFiles.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-lg overflow-hidden shadow-xl">
            {/* Header rojo completamente arriba */}
            <div className="bg-red-600 text-white px-6 py-4">
              <div className="flex items-center gap-3">
                <Trash2 className="h-6 w-6" />
                <h3 className="text-xl font-semibold">Delete Multiple Reports</h3>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Are you sure?</span>
                </div>
                <p className="text-sm">
                  This action cannot be undone. This will permanently delete{" "}
                  <span className="font-medium">{selectedFiles.length}</span> selected file{selectedFiles.length === 1 ? '' : 's'}.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">
                  <div className="font-medium mb-2">Selected files:</div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {selectedFiles.map(fileId => {
                      const file = completedFiles.find(f => f.id === fileId);
                      return file ? (
                        <div key={fileId} className="text-xs bg-white px-2 py-1 rounded border">
                          {file.original_filename}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleBulkDeleteCancel}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmBulkDelete}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {selectedFiles.length} File{selectedFiles.length === 1 ? '' : 's'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
