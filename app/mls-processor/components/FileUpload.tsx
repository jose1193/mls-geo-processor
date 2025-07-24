"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";

interface FileUploadProps {
  onProcessFile: (file: File) => void;
  isProcessing: boolean;
}

interface FileInfo {
  name: string;
  size: string;
  type: string;
  rows: number;
}

export function FileUpload({ onProcessFile, isProcessing }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): boolean => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    return (
      validTypes.includes(file.type) || validExtensions.includes(fileExtension)
    );
  };

  const readFileForPreview = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (!e.target?.result) {
            reject(new Error("Could not read the file"));
            return;
          }
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData.length);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFile = async (file: File) => {
    if (!validateFile(file)) {
      alert("Please select a valid Excel (.xlsx, .xls) or CSV file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      // 50MB limit
      alert("The file is too large. Maximum 50MB allowed.");
      return;
    }

    try {
      // Read file to get row count
      const rowCount = await readFileForPreview(file);

      setSelectedFile(file);
      setFileInfo({
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || "Spreadsheet file",
        rows: rowCount,
      });
    } catch (error) {
      console.error("Error reading file:", error);
      setSelectedFile(file);
      setFileInfo({
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || "Spreadsheet file",
        rows: 0, // Default if can't read
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleProcess = () => {
    if (selectedFile) {
      onProcessFile(selectedFile);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    setFileInfo(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 mb-8 shadow-sm border border-blue-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        📤 Upload Excel/CSV File
      </h3>

      <div
        className={`border-3 border-dashed rounded-xl p-8 text-center mls-clickable mls-file-upload ${
          isDragOver ? "border-blue-400 bg-blue-50" : "border-blue-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <div className="text-6xl mb-4 text-blue-500">📊</div>
        <div className="text-lg font-medium text-gray-700 mb-2">
          Click here or drag your file
        </div>
        <div className="text-sm text-gray-500">
          Supports: .xlsx, .xls, .csv (up to 50MB)
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {fileInfo && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">📄 File Loaded</h4>
          <div className="space-y-1 text-sm text-green-700">
            <p>
              <strong>Name:</strong> {fileInfo.name}
            </p>
            <p>
              <strong>Size:</strong> {fileInfo.size}
            </p>
            <p>
              <strong>Type:</strong> {fileInfo.type}
            </p>
            <p>
              <strong>Detected rows:</strong> {fileInfo.rows.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {fileInfo && !isProcessing && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleProcess}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold button-mls-primary flex items-center gap-2"
          >
            🚀 Process File
          </button>
          <button
            onClick={clearFile}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold button-mls"
          >
            🗑️ Remove File
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800">
            <div className="animate-spin">⏳</div>
            <span className="font-medium">Processing file...</span>
          </div>
        </div>
      )}
    </div>
  );
}
