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
import "../styles/glassmorphism.css";

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

  const formatFileSize = (file: {
    file_size_bytes?: number | null;
    original_file_size?: number | null;
    total_records?: number;
  }): string => {
    // Try file_size_bytes first (processed file size)
    let bytes = file?.file_size_bytes;

    // If not available, try original_file_size as backup
    if (!bytes && file?.original_file_size) {
      bytes = file.original_file_size;
    }

    // If we have actual bytes, format them
    if (bytes && bytes > 0) {
      const mb = bytes / (1024 * 1024);
      if (mb < 1) {
        const kb = bytes / 1024;
        return `${kb.toFixed(1)} KB`;
      }
      return `${mb.toFixed(2)} MB`;
    }

    // If no exact size available, estimate based on records
    // (roughly 100-200 bytes per record for processed Excel files)
    if (file?.total_records) {
      const estimatedBytes = file.total_records * 150; // conservative estimate
      const estimatedMB = estimatedBytes / (1024 * 1024);
      if (estimatedMB < 1) {
        const estimatedKB = estimatedBytes / 1024;
        return `~${estimatedKB.toFixed(0)} KB`;
      }
      return `~${estimatedMB.toFixed(1)} MB`;
    }

    return "Size unavailable";
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
      <Card className="glass-card neon-card bg-gray-800/90 border-gray-700 backdrop-blur-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <CardTitle className="text-sm font-medium text-white">
                Auto-Save Status
              </CardTitle>
            </div>
            {autoSaveState.isSaving && (
              <Badge
                variant="outline"
                className="text-blue-400 border-blue-400/50 bg-blue-900/30"
              >
                Saving...
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-gray-300 mb-3">{getStatusText()}</p>

          {/* Progress indicator for auto-save */}
          {autoSaveState.isSaving && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2 bg-gray-700/50" />
              <p className="text-xs text-center text-gray-400">
                Saving file to storage...
              </p>
            </div>
          )}

          {/* Error display */}
          {autoSaveState.error && (
            <Alert
              variant="destructive"
              className="mt-3 bg-red-900/50 border-red-600"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex justify-between items-center text-red-300">
                <span>{autoSaveState.error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAutoSaveError}
                  className="ml-2 glass-button glass-button-red"
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
              <Alert className="mt-3 bg-green-900/50 border-green-600">
                <CheckCircle className="h-4 w-4 text-green-400 " />
                <AlertDescription className="text-green-300">
                  File saved successfully!
                </AlertDescription>
              </Alert>
            )}
        </CardContent>
      </Card>

      {/* Completed Files List */}
      <Card className="glass-card neon-card bg-gray-800/90 border-gray-700 backdrop-blur-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white">
              Completed Files
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshCompletedFiles}
              disabled={isLoadingFiles}
              className="glass-button glass-button-blue"
            >
              {isLoadingFiles ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Refresh
            </Button>
          </div>
          <CardDescription className="text-gray-400">
            Files automatically saved to storage after 100% completion
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingFiles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-400">
                Loading files...
              </span>
            </div>
          ) : completedFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
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
                  className="flex items-center justify-between p-3 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-600/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <p className="text-sm font-medium truncate text-white">
                        {file.original_filename}
                      </p>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-purple-900/50 text-purple-300 border-purple-600/50"
                      >
                        {file.total_records} records
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-xs">
                      <span className="text-blue-300">
                        Completed:{" "}
                        <span className="text-green-300 font-medium">
                          {new Date(file.completed_at).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="text-purple-300">
                        Size:{" "}
                        <span className="text-orange-300 font-medium">
                          {formatFileSize(file)}
                        </span>
                      </span>
                      <span className="text-cyan-300">
                        Records:{" "}
                        <span className="text-yellow-300 font-medium">
                          {file.total_records.toLocaleString()}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-3">
                    {file.storage_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 px-2 glass-button glass-button-green"
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
                      className="h-8 px-2 glass-button glass-button-gray"
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
                  <p className="text-xs text-gray-400">
                    Showing 5 of {completedFiles.length} files
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
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
