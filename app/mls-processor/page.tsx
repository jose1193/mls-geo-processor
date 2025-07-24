"use client";

import { FileUpload } from "./components/FileUpload";
import { StatsGrid } from "./components/StatsGrid";
import { APIStatus } from "./components/APIStatus";
import { ProcessingProgress } from "./components/ProcessingProgress";
import { LogsPanel } from "./components/LogsPanel";
import { ResultsTable } from "./components/ResultsTable";
import { ColumnDetection } from "./components/ColumnDetection";
import { useMLSProcessor } from "./hooks/useMLSProcessor";
import { useEffect } from "react";

export default function MLSProcessorPage() {
  const {
    stats,
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
    // Recovery functions
    showRecoveryDialog,
    recoveryData,
    continueFromProgress,
    discardProgress,
    downloadPartialResults,
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
        <APIStatus />

        {/* Debug Panel - Remove in production */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">
            🔧 Debug Panel
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                // Simulate saved progress for testing
                const testData = {
                  results: [],
                  currentIndex: 15,
                  totalAddresses: 100,
                  fileName: "test_file.xlsx",
                  timestamp: Date.now(),
                  stats: {
                    totalProcessed: 15,
                    successRate: "80%",
                    mapboxCount: 15,
                    geoapifyCount: 0,
                    geminiCount: 0,
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
                console.log("🧪 Test data saved to localStorage");
                window.location.reload();
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
            >
              🧪 Simulate Saved Progress
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
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm"
            >
              🔍 Check localStorage
            </button>

            <button
              onClick={() => {
                localStorage.clear();
                console.log("🗑️ localStorage cleared");
                alert("localStorage cleared");
              }}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
            >
              🗑️ Clear localStorage
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
                ? `Found (${recoveryData.currentIndex}/${recoveryData.totalAddresses})`
                : "None"}
            </p>
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

        {/* Recovery Dialog */}
        {showRecoveryDialog && recoveryData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl">
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
      </div>
    </div>
  );
}
