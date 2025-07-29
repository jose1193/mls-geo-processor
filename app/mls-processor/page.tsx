"use client";

import { FileUpload } from "./components/FileUpload";
import { StatsGrid } from "./components/StatsGrid";
import { APIStatus } from "./components/APIStatus";
import { ProcessingProgress } from "./components/ProcessingProgress";
import { LogsPanel } from "./components/LogsPanel";
import { ResultsTable } from "./components/ResultsTable";
import { ColumnDetection } from "./components/ColumnDetection";
import { useMLSProcessor } from "./hooks/useMLSProcessor";
import { useEffect, useState } from "react";

export default function MLSProcessorPage() {
  // State for clear confirmation modal
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearModalData, setClearModalData] = useState<{
    fileName: string;
    currentIndex: number;
    totalAddresses: number;
    timestamp: number;
    stats: {
      successRate: string;
      totalProcessed: number;
      mapboxCount: number;
      geoapifyCount: number;
      geminiCount: number;
    };
  } | null>(null);

  const {
    stats,
    apiUsage,
    apiLimits,
    logs,
    isProcessing,
    progress,
    results,
    detectedColumns,
    fileData,
    processFile,
    previewFile,
    clearLogs,
    clearResults,
    downloadResults,
    stopProcessing,
    resetApiUsage,
    refreshApiUsage,
    // Recovery functions
    showRecoveryDialog,
    setShowRecoveryDialog,
    recoveryData,
    continueFromProgress,
    discardProgress,
    downloadPartialResults,
    // Success modal
    showSuccessModal,
    setShowSuccessModal,
  } = useMLSProcessor();

  // Debug recovery state
  useEffect(() => {
    console.log("🔍 Recovery state debug:", {
      showRecoveryDialog,
      hasRecoveryData: !!recoveryData,
      recoveryData: recoveryData
        ? {
            fileName: recoveryData.fileName,
            currentIndex: recoveryData.currentIndex,
            totalAddresses: recoveryData.totalAddresses,
            timestamp: new Date(recoveryData.timestamp).toLocaleString(),
          }
        : null,
    });
  }, [showRecoveryDialog, recoveryData]);

  // Function to handle success modal close with API usage refresh
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    // Force refresh API usage from localStorage after closing modal
    setTimeout(() => {
      refreshApiUsage();
    }, 100);
  };

  // Additional debug effect to monitor localStorage changes
  useEffect(() => {
    const checkLocalStoragePeriodically = () => {
      const saved = localStorage.getItem("mls_processing_progress");
      if (saved && !showRecoveryDialog && !recoveryData) {
        console.log(
          "⚠️ Found localStorage data but no recovery dialog shown!",
          {
            hasData: !!saved,
            showRecoveryDialog,
            hasRecoveryData: !!recoveryData,
          }
        );
      }
    };

    const interval = setInterval(checkLocalStoragePeriodically, 3000);
    return () => clearInterval(interval);
  }, [showRecoveryDialog, recoveryData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-8 mb-8 text-center">
          <div className="inline-block bg-white/20 px-4 py-2 rounded-full text-sm mb-4">
            V4.0 - Auto-Detection + Next.js
          </div>
          <h1 className="text-4xl font-bold mb-2">
            🌍 Geographic Enrichment System
          </h1>
          <p className="text-blue-100">
            Automated processing with column detection and preconfigured APIs
          </p>
        </div>

        {/* Stats Grid */}
        <StatsGrid stats={stats} />

        {/* API Status */}
        <APIStatus apiUsage={apiUsage} apiLimits={apiLimits} />

        {/* Debug Panel - Remove in production */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">
            🔧 Debug Panel
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                // Check if there's real recovery data in localStorage
                const saved = localStorage.getItem("mls_processing_progress");
                if (saved) {
                  try {
                    const data = JSON.parse(saved);
                    console.log("📋 Found real recovery data:", data);

                    // Show the existing recovery dialog
                    window.location.reload();
                  } catch (error) {
                    console.error("❌ Error parsing saved data:", error);
                    alert("Found corrupted recovery data. Clearing...");
                    localStorage.removeItem("mls_processing_progress");
                  }
                } else {
                  alert(
                    "No previous session found. Process a file first to see recovery functionality."
                  );
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm cursor-pointer"
            >
              📋 Show Last Session
            </button>

            {/* Temporary Demo Button for debugging */}
            <button
              onClick={() => {
                // Generate test data for debugging recovery
                const testData = {
                  results: [],
                  currentIndex: 25,
                  totalAddresses: 100,
                  fileName: `real_file_debug.xlsx`,
                  timestamp: Date.now(),
                  stats: {
                    totalProcessed: 25,
                    successRate: "85%",
                    mapboxCount: 25,
                    geoapifyCount: 2,
                    geminiCount: 20,
                  },
                  detectedColumns: {
                    address: "Address",
                    zip: "Zip Code",
                    city: "City Name",
                    county: "County",
                  },
                  validAddresses: [],
                };
                localStorage.setItem(
                  "mls_processing_progress",
                  JSON.stringify(testData)
                );
                console.log(
                  "🧪 Debug data created for recovery test:",
                  testData
                );
                alert(
                  "Debug data created. Close and reopen tab to test recovery."
                );
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm cursor-pointer hidden"
            >
              🧪 Create Test Data
            </button>

            <button
              onClick={() => {
                const saved = localStorage.getItem("mls_processing_progress");
                console.log("🔍 Current localStorage data:", saved);
                alert(
                  saved
                    ? "Data found in localStorage"
                    : "No data in localStorage"
                );
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm cursor-pointer"
            >
              🔍 Check localStorage
            </button>

            <button
              onClick={() => {
                console.log("🔄 Forcing recovery check...");
                window.location.reload();
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm cursor-pointer hidden"
            >
              🔄 Force Recovery Check
            </button>

            <button
              onClick={() => {
                // Get current localStorage data before showing confirmation
                const saved = localStorage.getItem("mls_processing_progress");
                if (saved) {
                  try {
                    const data = JSON.parse(saved);
                    setClearModalData(data);
                  } catch {
                    setClearModalData(null);
                  }
                } else {
                  setClearModalData(null);
                }
                setShowClearModal(true);
              }}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm cursor-pointer"
            >
              🗑️ Clear Cache
            </button>

            <button
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to reset API usage? This will reset all counters to zero."
                  )
                ) {
                  resetApiUsage();
                  alert("✅ Uso de APIs reseteado correctamente");
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm cursor-pointer"
            >
              🔄 Reset API Usage
            </button>
          </div>

          <div className="mt-3 text-sm text-yellow-700">
            <p>
              <strong>Recovery State:</strong>{" "}
              {showRecoveryDialog ? "Dialog Visible" : "No Dialog"}
            </p>
            <p>
              <strong>Recovery Data:</strong>{" "}
              {recoveryData
                ? `Found (${recoveryData.currentIndex}/${
                    recoveryData.totalAddresses
                  }) - ${
                    recoveryData.fileName.includes("demo_file") ||
                    recoveryData.fileName.includes("test_file")
                      ? "🧪 Demo Session"
                      : "📄 Real Session"
                  }`
                : "None"}
            </p>
            {recoveryData && (
              <p>
                <strong>File:</strong> {recoveryData.fileName}
              </p>
            )}
          </div>
        </div>

        {/* File Upload */}
        <FileUpload onProcessFile={processFile} isProcessing={isProcessing} />

        {/* Column Detection */}
        <ColumnDetection
          detectedColumns={detectedColumns}
          fileData={fileData}
          onPreviewFile={previewFile}
        />

        {/* Processing Progress */}
        {isProcessing && (
          <ProcessingProgress progress={progress} onStop={stopProcessing} />
        )}

        {/* Logs Panel */}
        <LogsPanel logs={logs} onClearLogs={clearLogs} />

        {/* Results Table */}
        <ResultsTable
          results={results}
          onDownloadResults={downloadResults}
          onClearResults={clearResults}
        />

        {/* Clear Cache Confirmation Modal */}
        {showClearModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-lg mx-4 shadow-2xl relative">
              {/* Close X button */}
              <button
                onClick={() => setShowClearModal(false)}
                className="absolute top-3 right-3 bg-gray-500 hover:bg-gray-600 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer shadow-lg"
                title="Close dialog"
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
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Clear All Cache & Data
                </h2>
                <p className="text-gray-600">
                  This will permanently delete all cached data and processing
                  progress.
                </p>
              </div>

              {clearModalData ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-yellow-800 mb-3">
                    📋 Current Session Data:
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">File:</span>
                      <span className="text-gray-900">
                        {clearModalData.fileName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">
                        Progress:
                      </span>
                      <span className="text-green-600">
                        {clearModalData.currentIndex} /{" "}
                        {clearModalData.totalAddresses}(
                        {Math.round(
                          (clearModalData.currentIndex /
                            clearModalData.totalAddresses) *
                            100
                        )}
                        %)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Date:</span>
                      <span className="text-gray-600">
                        {new Date(clearModalData.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">
                        Success Rate:
                      </span>
                      <span className="text-blue-600">
                        {clearModalData.stats.successRate}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-gray-600 text-center">
                    📭 No processing session data found
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => {
                    localStorage.clear();
                    console.log("🗑️ All localStorage data cleared");
                    setShowClearModal(false);
                    setShowRecoveryDialog(false);
                    // Reload page to reset everything
                    setTimeout(() => {
                      window.location.reload();
                    }, 300);
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  🗑️ Delete All Data
                </button>

                <button
                  onClick={() => setShowClearModal(false)}
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recovery Dialog */}
        {showRecoveryDialog && recoveryData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl relative">
              {/* Close X button */}
              <button
                onClick={() => setShowRecoveryDialog(false)}
                className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer shadow-lg"
                title="Close dialog"
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
                <div className="text-6xl mb-4">🔄</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Previous Session Found
                </h2>
                <p className="text-gray-600">
                  We found a previous processing session that was interrupted.
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">File:</span>
                  <span className="text-blue-600">{recoveryData.fileName}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">Progress:</span>
                  <span className="text-green-600">
                    {recoveryData.currentIndex} / {recoveryData.totalAddresses}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Date:</span>
                  <span className="text-gray-600">
                    {new Date(recoveryData.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={continueFromProgress}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  ✅ Continue Processing
                </button>

                <button
                  onClick={downloadPartialResults}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  📥 Download Partial Results
                </button>

                <button
                  onClick={discardProgress}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  🗑️ Start Fresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl relative">
              {/* Close X button */}
              <button
                onClick={handleSuccessModalClose}
                className="absolute top-3 right-3 bg-gray-500 hover:bg-gray-600 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer shadow-lg"
                title="Close dialog"
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
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-green-800 mb-2">
                  Processing Completed Successfully!
                </h2>
                <p className="text-gray-600">
                  All addresses have been processed and geocoded successfully.
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">
                    Total Processed:
                  </span>
                  <span className="text-green-600 font-bold">
                    {results.length}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">
                    Success Rate:
                  </span>
                  <span className="text-green-600 font-bold">
                    {stats.successRate}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">
                    Completion:
                  </span>
                  <span className="text-green-600 font-bold">100%</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSuccessModalClose}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  ✅ OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
