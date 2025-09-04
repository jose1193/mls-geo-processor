// ===================================================================
// AUTO-SAVE STATUS COMPONENT
// Shows real-time auto-save progress and completed files
// ===================================================================

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { AutoSaveState } from "../hooks/useAutoSave";

interface AutoSaveStatusProps {
  autoSaveState: AutoSaveState;
  refreshCompletedFiles: () => void;
  clearAutoSaveError: () => void;
  className?: string;
}

export function AutoSaveStatus({
  autoSaveState,
  refreshCompletedFiles,
  clearAutoSaveError,
  className = "",
}: AutoSaveStatusProps) {
  // Use completed files directly from autoSaveState
  const completedFiles = autoSaveState.completedFiles;
  const isLoadingFiles = autoSaveState.isLoadingFiles;

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getStatusIcon = () => {
    if (autoSaveState.isSaving) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (autoSaveState.error) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (autoSaveState.lastSaved) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (autoSaveState.isSaving) {
      return "Saving...";
    }
    if (autoSaveState.error) {
      return "Auto-save failed";
    }
    if (autoSaveState.lastSaved) {
      return `Last saved: ${formatTimeAgo(autoSaveState.lastSaved)} ago`;
    }
    return "Ready to auto-save when processing completes";
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Auto-Save Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <CardTitle className="text-sm font-medium">
                Auto-Save Status
              </CardTitle>
            </div>
            {autoSaveState.isSaving && (
              <Badge
                variant="outline"
                className="text-blue-600 border-blue-200"
              >
                Saving...
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3">
            {getStatusText()}
          </p>

          {/* Progress indicator for auto-save */}
          {autoSaveState.isSaving && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Saving file to storage...
              </p>
            </div>
          )}

          {/* Error display */}
          {autoSaveState.error && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex justify-between items-center">
                <span>{autoSaveState.error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAutoSaveError}
                  className="ml-2"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Success message */}
          {autoSaveState.lastSaved &&
            !autoSaveState.isSaving &&
            !autoSaveState.error && (
              <Alert className="mt-3 border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  File saved successfully!
                </AlertDescription>
              </Alert>
            )}
        </CardContent>
      </Card>

      {/* Completed Files List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Completed Files
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshCompletedFiles}
              disabled={isLoadingFiles}
            >
              {isLoadingFiles ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Refresh
            </Button>
          </div>
          <CardDescription>
            Files automatically saved to storage after 100% completion
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingFiles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading files...
              </span>
            </div>
          ) : completedFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No completed files yet</p>
              <p className="text-xs">
                Files will appear here after processing completes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedFiles.slice(0, 5).map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <p className="text-sm font-medium truncate">
                        {file.original_filename}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {file.total_records} records
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>
                        Completed:{" "}
                        {new Date(file.completed_at).toLocaleDateString()}
                      </span>
                      <span>
                        Size: {formatFileSize(file.file_size_bytes || null)}
                      </span>
                      <span>
                        Records: {file.total_records.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-3">
                    {file.storage_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 px-2"
                      >
                        <a
                          href={file.storage_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1"
                        >
                          <Download className="h-3 w-3" />
                          <span className="sr-only">Download</span>
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => {
                        // Could open a modal with more details
                        console.log("File details:", file);
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="sr-only">Details</span>
                    </Button>
                  </div>
                </div>
              ))}

              {completedFiles.length > 5 && (
                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground">
                    Showing 5 of {completedFiles.length} files
                  </p>
                  <Button variant="link" size="sm" className="text-xs">
                    View all files →
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
