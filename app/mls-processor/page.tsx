"use client";

import { FileUpload } from "./components/FileUpload";
import { StatsGrid } from "./components/StatsGrid";
import { APIStatus } from "./components/APIStatus";
import { ProcessingProgress } from "./components/ProcessingProgress";
import { LogsPanel } from "./components/LogsPanel";
import { ResultsTable } from "./components/ResultsTable";
import { ColumnDetection } from "./components/ColumnDetection";
import { useMLSProcessor } from "./hooks/useMLSProcessor";

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
  } = useMLSProcessor();

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
      </div>
    </div>
  );
}
