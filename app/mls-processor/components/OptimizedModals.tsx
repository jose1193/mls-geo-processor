"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  RefreshCw,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";

// Import the interface from the hook instead of redefining it
import type { OptimizedProcessingProgress } from "../hooks/useMLSProcessor-optimized";

interface OptimizedModalsProps {
  // Recovery Modal
  showRecoveryModal: boolean;
  recoveryData: OptimizedProcessingProgress | null;
  onContinueFromProgress: () => void;
  onDiscardProgress: () => void;
  onDownloadRecoveryResults: () => void;
  onCloseRecoveryModal: () => void;

  // Stop Modal
  showStopModal: boolean;
  onExportResults: () => void;
  onClearResults: () => void;
  onCloseStopModal: () => void;

  // Success Modal
  showSuccessModal: boolean;
  onCloseSuccessModal: () => void;
  totalProcessed: number;
  successRate: string;
  processingTime: string;
}

export default function OptimizedModals({
  showRecoveryModal,
  recoveryData,
  onContinueFromProgress,
  onDiscardProgress,
  onDownloadRecoveryResults,
  onCloseRecoveryModal,
  showStopModal,
  onExportResults,
  onClearResults,
  onCloseStopModal,
  showSuccessModal,
  onCloseSuccessModal,
  totalProcessed,
  successRate,
  processingTime,
}: OptimizedModalsProps) {
  if (!showRecoveryModal && !showStopModal && !showSuccessModal) {
    return null;
  }

  return (
    <>
      {/* Recovery Modal - glassmorphism style */}
      {showRecoveryModal && recoveryData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-gray-800/90 border-gray-700 neon-card backdrop-blur-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-3 text-xl">
                <RefreshCw className="h-6 w-6 text-blue-400" />
                Resume Previous Session?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-blue-900/50 border-blue-600">
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-blue-300">
                  <strong>Previous session found!</strong> You were processing{" "}
                  {recoveryData.fileName}
                  and completed {recoveryData.results.length} out of{" "}
                  {recoveryData.totalAddresses} records (
                  {Math.round(
                    (recoveryData.results.length /
                      recoveryData.totalAddresses) *
                      100
                  )}
                  % complete).
                </AlertDescription>
              </Alert>

              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h4 className="text-white font-semibold mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Session Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">File:</span>
                    <span className="text-white ml-2">
                      {recoveryData.fileName}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Progress:</span>
                    <span className="text-green-400 ml-2">
                      {recoveryData.results.length} /{" "}
                      {recoveryData.totalAddresses}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Success Rate:</span>
                    <span className="text-blue-400 ml-2">
                      {recoveryData.stats.successRate}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Last Saved:</span>
                    <span className="text-purple-400 ml-2">
                      {new Date(recoveryData.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={onContinueFromProgress}
                  className="glass-button glass-button-blue flex-1 bg-green-900/30 border border-green-500/30 text-green-200 font-medium px-4 py-2 rounded-lg hover:bg-green-900/50 hover:border-green-500/50 transition-all duration-300"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Continue Processing
                </Button>

                <Button
                  onClick={onDownloadRecoveryResults}
                  className="glass-button glass-button-blue flex-1 bg-blue-900/30 border border-blue-500/30 text-blue-200 font-medium px-4 py-2 rounded-lg hover:bg-blue-900/50 hover:border-blue-500/50 transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Partial Results
                </Button>

                <Button
                  onClick={onDiscardProgress}
                  className="glass-button glass-button-red flex-1 bg-red-900/30 border border-red-500/30 text-red-200 font-medium px-4 py-2 rounded-lg hover:bg-red-900/50 hover:border-red-500/50 transition-all duration-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Start Fresh
                </Button>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={onCloseRecoveryModal}
                  variant="ghost"
                  className="bg-gray-700/50 border border-gray-600 text-gray-300 hover:bg-gray-600/50 hover:text-white transition-all duration-300"
                >
                  <X className="h-4 w-4 mr-2" />
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stop Modal - glassmorphism style */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-gray-800/90 border-gray-700 neon-card backdrop-blur-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-3 text-xl">
                <AlertTriangle className="h-6 w-6 text-orange-400" />
                Processing Stopped
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-orange-900/50 border-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-orange-300">
                  Processing has been stopped. What would you like to do with
                  your current progress?
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={onExportResults}
                  className="glass-button glass-button-blue bg-blue-900/30 border border-blue-500/30 text-blue-200 font-medium px-4 py-2 rounded-lg hover:bg-blue-900/50 hover:border-blue-500/50 transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Current Results
                </Button>

                <Button
                  onClick={onClearResults}
                  className="glass-button glass-button-red bg-red-900/30 border border-red-500/30 text-red-200 font-medium px-4 py-2 rounded-lg hover:bg-red-900/50 hover:border-red-500/50 transition-all duration-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All & Start Over
                </Button>

                <Button
                  onClick={onCloseStopModal}
                  variant="outline"
                  className="bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-600/50 hover:text-white transition-all duration-300"
                >
                  💾 Save Progress & Continue Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Modal - glassmorphism style */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-gray-800/90 border-gray-700 neon-card backdrop-blur-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-3 text-xl">
                <CheckCircle className="h-6 w-6 text-green-400" />
                Processing Complete!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-green-900/50 border-green-600">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription className="text-green-300">
                  <strong>Success!</strong> Processed {totalProcessed} records
                  with {successRate} success rate in {processingTime}.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={onExportResults}
                  className="glass-button glass-button-blue flex-1 bg-green-900/30 border border-green-500/30 text-green-200 font-medium px-4 py-2 rounded-lg hover:bg-green-900/50 hover:border-green-500/50 transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Results
                </Button>

                <Button
                  onClick={onCloseSuccessModal}
                  className="glass-button glass-button-blue flex-1 bg-blue-900/30 border border-blue-500/30 text-blue-200 font-medium px-4 py-2 rounded-lg hover:bg-blue-900/50 hover:border-blue-500/50 transition-all duration-300"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
