import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import "../styles/glassmorphism.css";
import {
  Play,
  Square,
  Download,
  Trash2,
  Settings,
  Clock,
  TrendingUp,
  Database,
  Zap,
  Activity,
} from "lucide-react";

import Image from "next/image";
import { useMLSProcessorOptimized } from "@/app/mls-processor/hooks/useMLSProcessor-optimized";
import OptimizedModals from "./OptimizedModals";

const OptimizedMLSProcessor = () => {
  const {
    stats,
    logs,
    isProcessing,
    progress,
    results,
    detectedColumns,
    fileData,
    batchConfig,
    handleFileUpload,
    startProcessing,
    stopProcessing,
    clearResults,
    exportResults,
    updateBatchConfig,
    setDetectedColumns,
    performanceMetrics,

    // Modal States
    showRecoveryModal,
    showStopModal,
    showSuccessModal,
    recoveryData,

    // Recovery Actions
    continueFromProgress,
    discardProgress,
    downloadRecoveryResults,

    // Modal Controls
    closeStopModal,
    closeRecoveryModal,
    closeSuccessModal,
  } = useMLSProcessorOptimized();

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Log performance metrics to console for debugging
  React.useEffect(() => {
    if (performanceMetrics.totalRequests > 0) {
      console.log("Performance Metrics:", performanceMetrics);
    }
  }, [performanceMetrics]);

  // File upload handler
  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  // Clear all data including file
  const clearAll = useCallback(() => {
    clearResults();
    // Clear file data by resetting file input
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
    // Reset detected columns
    setDetectedColumns({
      address: null,
      city: null,
      county: null,
      zip: null,
      mlNumber: null,
      neighborhoods: null,
      communities: null,
    });
  }, [clearResults, setDetectedColumns]);

  // Performance status indicator
  const getPerformanceStatus = () => {
    const throughput = stats.throughputPerSecond;
    if (throughput >= 25) return { color: "bg-green-500", text: "Excellent" };
    if (throughput >= 15) return { color: "bg-blue-500", text: "Good" };
    if (throughput >= 5) return { color: "bg-yellow-500", text: "Fair" };
    return { color: "bg-red-500", text: "Slow" };
  };

  const performanceStatus = getPerformanceStatus();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 rounded-3xl border-4 border-purple-700/60"
      style={{
        boxShadow:
          "0 0 40px 8px rgba(128,0,192,0.45), 0 8px 32px 0 rgba(128,0,128,0.35)",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-6 mb-5">
        {/* Header */}
        <div className="text-center mt-4 mb-6">
          <h1 className="text-4xl font-bold mb-4">
            🚀{" "}
            <span className="shimmer-title">
              Optimized MLS Geocoding Processor
            </span>
          </h1>
          <p className="text-gray-300 mb-2">
            ⚡ High-Performance Pipeline - Built for 100K+ Records
          </p>
        </div>

        {/* Performance Dashboard */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 justify-center w-full"
          style={{ marginBottom: "2.5rem" }}
        >
          <Card className="glass-card neon-card w-full lg:max-w-xs mx-auto">
            <CardContent className="p-4 flex flex-col items-center justify-center w-full">
              <TrendingUp className="h-8 w-8 text-green-400 mb-2" />
              <p className="text-sm text-gray-400 text-center">Throughput</p>
              <p className="text-xl font-bold text-white text-center">
                {stats.throughputPerSecond.toFixed(1)}/s
              </p>
            </CardContent>
          </Card>
          <Card className="glass-card neon-card w-full lg:max-w-xs mx-auto">
            <CardContent className="p-4 flex flex-col items-center justify-center w-full">
              <Clock className="h-8 w-8 text-blue-400 mb-2" />
              <p className="text-sm text-gray-400 text-center">Avg Time</p>
              <p className="text-xl font-bold text-white text-center">
                {stats.avgProcessingTimeMs}ms
              </p>
            </CardContent>
          </Card>
          <Card className="glass-card neon-card w-full lg:max-w-xs mx-auto">
            <CardContent className="p-4 flex flex-col items-center justify-center w-full">
              <Database className="h-8 w-8 text-purple-400 mb-2" />
              <p className="text-sm text-gray-400 text-center">Cache Hits</p>
              <p className="text-xl font-bold text-white text-center">
                {stats.cacheHits}
              </p>
            </CardContent>
          </Card>
          <Card className="glass-card neon-card w-full lg:max-w-xs mx-auto">
            <CardContent className="p-4 flex flex-col items-center justify-center w-full">
              <Activity className={`h-8 w-8 text-blue-400 mb-2`} />
              <p className="text-sm text-gray-400 text-center">Status</p>
              <Badge className={performanceStatus.color + " mt-1 mx-auto"}>
                {performanceStatus.text}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Main Control Panel */}
        <Card className="bg-gray-800/50 border-gray-700 neon-card mt-10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Processing Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload */}
            <div className="space-y-3">
              {!fileData && (
                <label
                  htmlFor="file-upload"
                  className="glass-button glass-button-blue flex items-center gap-2 cursor-pointer font-medium text-base px-3 py-2 w-full lg:w-auto"
                  style={{ display: isProcessing ? "none" : "inline-flex" }}
                >
                  {/* Upload arrow icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                    />
                  </svg>
                  <span>Upload MLS Excel File</span>
                </label>
              )}
              {fileData && (
                <div className="flex items-center gap-2">
                  <div
                    className="glass-button glass-button-blue flex items-center gap-2 font-medium text-base px-3 py-2 w-auto min-w-[140px] max-w-[180px] cursor-default"
                    style={{ opacity: 1 }}
                  >
                    {/* Folder icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7a2 2 0 012-2h3.172a2 2 0 011.414.586l.828.828A2 2 0 0012.828 7H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                      />
                    </svg>
                    <span>File Ready</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Clear file"
                    className="glass-button glass-button-red flex items-center justify-center px-2 py-2 ml-1 cursor-pointer"
                    style={{ minWidth: "32px", height: "32px" }}
                    onClick={clearAll}
                    disabled={isProcessing}
                  >
                    {/* X icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileChange}
                className="hidden"
                disabled={isProcessing}
              />
              {/* Frase 'Choose file' eliminada para un diseño más limpio */}
              {fileData && (
                <div className="mt-3 p-3 bg-green-900/30 rounded-lg border border-green-500/30">
                  <p className="text-sm text-green-300 font-medium">
                    ✅ <span className="text-green-200">Loaded:</span>{" "}
                    {fileData.fileName}
                    <span className="text-green-400 font-bold">
                      {" "}
                      ({fileData.data.length.toLocaleString()} records)
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Column Detection Display */}
            {fileData && (
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h4 className="text-white font-semibold mb-3 flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  Detected Columns
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(
                    [
                      "mlNumber",
                      "address",
                      "city",
                      "county",
                      "zip",
                      "neighborhoods",
                      "communities",
                    ] as const
                  ).map((field) => (
                    <div key={field} className="text-center">
                      <Label className="text-gray-300 capitalize text-sm">
                        {field === "mlNumber"
                          ? "ML#"
                          : field === "neighborhoods"
                            ? "Neighborhoods"
                            : field === "communities"
                              ? "Communities"
                              : field}
                      </Label>
                      <div className="mt-1 p-2 bg-slate-800 rounded border border-slate-600">
                        <span
                          className={`font-medium text-sm ${
                            detectedColumns[field]
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {detectedColumns[field] || "Not detected"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            <div className="w-full">
              <Button
                variant="outline"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all duration-300 w-full lg:w-auto mb-2"
              >
                <Settings className="h-4 w-4 mr-2" />
                Advanced Settings
              </Button>
            </div>

            {showAdvancedSettings && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-900/50 rounded-lg w-full">
                <div className="w-full flex flex-col items-center">
                  <Label className="text-gray-300 mb-2 block w-full text-center">
                    Batch Size
                  </Label>
                  <Input
                    type="number"
                    value={batchConfig.batchSize}
                    onChange={(e) =>
                      updateBatchConfig({ batchSize: parseInt(e.target.value) })
                    }
                    className="bg-gray-700 border-gray-600 text-white mt-2 w-full text-center"
                    min="100"
                    max="5000"
                    disabled={isProcessing}
                  />
                </div>
                <div className="w-full flex flex-col items-center">
                  <Label className="text-gray-300 mb-2 block w-full text-center">
                    Concurrency
                  </Label>
                  <Input
                    type="number"
                    value={batchConfig.concurrencyLimit}
                    onChange={(e) =>
                      updateBatchConfig({
                        concurrencyLimit: parseInt(e.target.value),
                      })
                    }
                    className="bg-gray-700 border-gray-600 text-white mt-2 w-full text-center"
                    min="5"
                    max="50"
                    disabled={isProcessing}
                  />
                </div>
                <div className="w-full flex flex-col items-center">
                  <Label className="text-gray-300 mb-2 block w-full text-center">
                    Max Retries
                  </Label>
                  <Input
                    type="number"
                    value={batchConfig.maxRetries}
                    onChange={(e) =>
                      updateBatchConfig({
                        maxRetries: parseInt(e.target.value),
                      })
                    }
                    className="bg-gray-700 border-gray-600 text-white mt-2 w-full text-center"
                    min="1"
                    max="5"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex flex-col lg:flex-row gap-4 w-full mt-4 lg:items-center">
              <Button
                onClick={startProcessing}
                disabled={isProcessing || !fileData || !detectedColumns.address}
                className="bg-green-900/30 border border-green-500/30 text-green-200 font-medium px-4 py-2 rounded-lg hover:bg-green-900/50 hover:border-green-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/30 w-full lg:w-auto"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Processing
              </Button>

              <Button
                onClick={stopProcessing}
                disabled={!isProcessing}
                className="bg-red-900/30 border border-red-500/30 text-red-200 font-medium px-4 py-2 rounded-lg hover:bg-red-900/50 hover:border-red-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-red-500/30 w-full lg:w-auto"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>

              <Button
                onClick={exportResults}
                disabled={!results.length}
                className="bg-blue-900/30 border border-blue-500/30 text-blue-200 font-medium px-4 py-2 rounded-lg hover:bg-blue-900/50 hover:border-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/30 w-full lg:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </Button>

              <Button
                onClick={clearAll}
                disabled={isProcessing}
                variant="outline"
                className="bg-orange-900/30 border border-orange-500/30 text-orange-200 font-medium px-4 py-2 rounded-lg hover:bg-orange-900/50 hover:border-orange-500/50 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-500/30 w-full lg:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress & Stats */}
        {(isProcessing || progress.total > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Progress Card */}
            <Card className="bg-gray-800/50 border-gray-700 neon-card">
              <CardHeader>
                <CardTitle className="text-white">
                  Processing Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Custom Dynamic Progress Bar */}
                <div className="w-full neon-table">
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-700/50 backdrop-blur-sm">
                    <div
                      className={`h-full transition-all duration-500 ease-in-out ${
                        progress.percentage === 100
                          ? "bg-gradient-to-r from-green-500 to-green-400 shadow-lg shadow-green-500/50"
                          : progress.percentage >= 80
                            ? "bg-gradient-to-r from-blue-500 to-blue-400 shadow-lg shadow-blue-500/30"
                            : progress.percentage >= 50
                              ? "bg-gradient-to-r from-yellow-500 to-yellow-400 shadow-lg shadow-yellow-500/30"
                              : "bg-gradient-to-r from-red-500 to-red-400 shadow-lg shadow-red-500/30"
                      } ${progress.percentage === 100 ? "animate-pulse" : ""}`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                    {progress.percentage === 100 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                    )}
                  </div>
                  {/* Progress Percentage Text */}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">Progress</span>
                    <span
                      className={`text-sm font-bold ${
                        progress.percentage === 100
                          ? "text-green-400"
                          : "text-white"
                      }`}
                    >
                      {progress.percentage.toFixed(1)}%
                      {progress.percentage === 100 && " ✨"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Progress</p>
                    <p className="text-white font-mono">
                      {progress.current.toLocaleString()} /{" "}
                      {progress.total.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400">Batch</p>
                    <p className="text-white font-mono">
                      {progress.currentBatch} / {progress.totalBatches}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400">Speed</p>
                    <p className="text-white font-mono">
                      {progress.throughputPerSecond} rec/s
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400">ETA</p>
                    <p className="text-white font-mono">
                      {progress.estimatedTimeRemaining}
                    </p>
                  </div>
                </div>

                {progress.currentAddress && (
                  <div>
                    <p className="text-gray-400 text-sm">
                      Currently processing:
                    </p>
                    <p className="text-white text-sm font-mono bg-gray-900/50 p-2 rounded">
                      {progress.currentAddress}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Stats Card */}
            <Card className="bg-gray-800/50 border-gray-700 neon-card">
              <CardHeader>
                <CardTitle className="text-white">API Usage Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-400">
                      <Image
                        src="/mapbox.png"
                        alt="Mapbox"
                        width={24}
                        height={24}
                        className="inline-block rounded"
                      />
                      Mapbox:
                    </span>
                    <Badge className="bg-blue-600 text-white">
                      {stats.mapboxCount}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-400">
                      <Image
                        src="/geocodio.png"
                        alt="Geocodio"
                        width={24}
                        height={24}
                        className="inline-block rounded"
                      />
                      Geocodio:
                    </span>
                    <Badge className="bg-green-600 text-white">
                      {stats.geocodioCount}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-400">
                      <Image
                        src="/gemini-color.png"
                        alt="Gemini"
                        width={24}
                        height={24}
                        className="inline-block rounded"
                      />
                      Gemini:
                    </span>
                    <Badge className="bg-purple-600 text-white">
                      {stats.geminiCount}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-400">
                      <Image
                        src="/cache.png"
                        alt="Cache Hits"
                        width={24}
                        height={20}
                        className="inline-block"
                      />
                      Cache Hits:
                    </span>
                    <Badge className="bg-orange-600 text-white">
                      {stats.cacheHits}
                    </Badge>
                  </div>

                  <div className="border-t border-gray-600 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-semibold">
                        Success Rate:
                      </span>
                      <Badge
                        className={
                          stats.successRate === "100.0%"
                            ? "bg-green-600 animate-pulse"
                            : stats.successRate.startsWith("9")
                              ? "bg-blue-600"
                              : "bg-yellow-600"
                        }
                      >
                        {stats.successRate}
                        {stats.successRate === "100.0%" && " ✨"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Activity Logs */}
        {logs.length > 0 && (
          <Card className="bg-gray-800/50 border-gray-700 neon-card">
            <CardHeader>
              <CardTitle className="text-white">Activity Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto results-scrollbar">
                {logs.slice(-20).map((log) => (
                  <div
                    key={log.id}
                    className={`text-sm p-2 rounded ${
                      log.type === "error"
                        ? "bg-red-900/50 text-red-300"
                        : log.type === "success"
                          ? "bg-green-900/50 text-green-300"
                          : log.type === "warning"
                            ? "bg-yellow-900/50 text-yellow-300"
                            : log.type === "performance"
                              ? "bg-blue-900/50 text-blue-300"
                              : "bg-gray-900/50 text-gray-300"
                    }`}
                  >
                    <span className="text-gray-400 text-xs">
                      {log.timestamp}
                      {log.batchNumber && ` [Batch ${log.batchNumber}]`}
                      {log.processingTimeMs && ` (${log.processingTimeMs}ms)`}
                    </span>
                    <br />
                    {log.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Summary */}
        {results.length > 0 && (
          <Card className="bg-gray-800/50 border-gray-700 neon-card">
            <CardHeader>
              <CardTitle className="text-white">
                Results Summary ({results.length} records)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="bg-blue-900/50 border-blue-600">
                <AlertDescription className="text-blue-300">
                  Processing completed! {results.length} records processed with{" "}
                  {stats.successRate} success rate. Average processing time:{" "}
                  {stats.avgProcessingTimeMs}ms per record. Use the Export
                  button to download your results.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Results Table - Real-time Data Display */}
        {results.length > 0 && (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>📊 Processed Results ({results.length} records)</span>
                <Badge
                  variant="outline"
                  className="text-green-400 border-green-400"
                >
                  Live Data
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96 overflow-y-auto results-scrollbar">
                <div className="overflow-x-auto results-scrollbar neon-table">
                  <table className="min-w-[1200px] w-full text-sm text-center">
                    <thead className="bg-gray-900/50 sticky top-0">
                      <tr className="text-gray-300">
                        <th className="p-3 border-b border-gray-600">ML#</th>
                        <th className="p-3 border-b border-gray-600">
                          Address
                        </th>
                        <th className="p-3 border-b border-gray-600">
                          Zip Code
                        </th>
                        <th className="p-3 border-b border-gray-600">
                          City Name
                        </th>
                        <th className="p-3 border-b border-gray-600">County</th>
                        <th className="p-3 border-b border-gray-600">
                          House Number
                        </th>
                        <th className="p-3 border-b border-gray-600">
                          Latitude
                        </th>
                        <th className="p-3 border-b border-gray-600">
                          Longitude
                        </th>
                        <th className="p-3 border-b border-gray-600">
                          Neighborhood
                        </th>
                        <th className="p-3 border-b border-gray-600">
                          Community
                        </th>
                        <th className="p-3 border-b border-gray-600">Status</th>
                        <th className="p-3 border-b border-gray-600">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.slice(-50).map((result, index) => (
                        <tr
                          key={index}
                          className={`border-b border-gray-700 hover:bg-gray-700/30 ${index < 5 ? "bg-blue-900/20" : "bg-purple-900/10"}`}
                        >
                          <td className="p-3 text-gray-400 text-center">
                            {result["ML#"] ||
                              result["mls_number"] ||
                              result["mls"] ||
                              result["listing_number"] ||
                              "N/A"}
                          </td>
                          <td className="p-3 text-white text-center">
                            {result["Address"] ||
                              result.original_address ||
                              "N/A"}
                          </td>
                          <td className="p-3 text-gray-300 text-center">
                            {result.zip || result["Zip Code"] || "N/A"}
                          </td>
                          <td className="p-3 text-gray-300 text-center">
                            {result.city ||
                              result["City Name"] ||
                              result.City ||
                              "N/A"}
                          </td>
                          <td className="p-3 text-gray-300 text-center">
                            {result.county || result["County"] || "N/A"}
                          </td>
                          <td className="p-3 text-gray-300 text-center">
                            {result["House Number"] || "N/A"}
                          </td>
                          <td className="p-3 text-green-300 font-mono text-xs text-center">
                            {result.latitude
                              ? parseFloat(String(result.latitude)).toFixed(4)
                              : "N/A"}
                          </td>
                          <td className="p-3 text-green-300 font-mono text-xs text-center">
                            {result.longitude
                              ? parseFloat(String(result.longitude)).toFixed(4)
                              : "N/A"}
                          </td>
                          <td className="p-3 text-blue-300 text-center">
                            {result.neighborhoods ||
                              result.neighborhood ||
                              result.neighbourhood ||
                              "N/A"}
                          </td>
                          <td className="p-3 text-blue-300 text-center">
                            {result.comunidades || result.community || "N/A"}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              variant="outline"
                              className={
                                result.latitude && result.longitude
                                  ? "text-green-400 border-green-400"
                                  : "text-red-400 border-red-400"
                              }
                            >
                              {result.latitude && result.longitude
                                ? "✓ Success"
                                : "✗ Failed"}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              variant="outline"
                              className={
                                result.api_source === "mapbox"
                                  ? "text-blue-400 border-blue-400"
                                  : result.api_source === "geocodio"
                                    ? "text-green-400 border-green-400"
                                    : "text-purple-400 border-purple-400"
                              }
                            >
                              {result.api_source || "Unknown"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {results.length > 50 && (
                  <div className="text-center py-3 text-gray-400 text-sm">
                    Showing last 50 of {results.length} records. Export to see
                    all data.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      <OptimizedModals
        // Recovery Modal
        showRecoveryModal={showRecoveryModal}
        recoveryData={recoveryData}
        onContinueFromProgress={continueFromProgress}
        onDiscardProgress={discardProgress}
        onDownloadRecoveryResults={downloadRecoveryResults}
        onCloseRecoveryModal={closeRecoveryModal}
        // Stop Modal
        showStopModal={showStopModal}
        onExportResults={exportResults}
        onClearResults={clearResults}
        onCloseStopModal={closeStopModal}
        // Success Modal
        showSuccessModal={showSuccessModal}
        onCloseSuccessModal={closeSuccessModal}
        totalProcessed={stats.totalProcessed}
        successRate={stats.successRate}
        processingTime={stats.estimatedTimeRemaining || "0s"}
      />
    </div>
  );
};

export default OptimizedMLSProcessor;
