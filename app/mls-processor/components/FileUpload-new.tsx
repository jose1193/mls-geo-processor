"use client";

import { useState, useRef } from "react";

interface FileUploadProps {
  onProcessFile: (file: File) => void;
  isProcessing: boolean;
}

interface FileInfo {
  name: string;
  size: string;
  type: string;
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

  const handleFile = (file: File) => {
    if (!validateFile(file)) {
      alert("Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV válido");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      // 50MB limit
      alert("El archivo es demasiado grande. Máximo 50MB permitido.");
      return;
    }

    setSelectedFile(file);
    setFileInfo({
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type || "Archivo de hoja de cálculo",
    });
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
        📤 Subir Archivo Excel/CSV
      </h3>

      <div
        className={`border-3 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
          isDragOver
            ? "border-blue-400 bg-blue-50"
            : "border-blue-300 hover:border-blue-400 hover:bg-blue-50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <div className="text-6xl mb-4 text-blue-500">📊</div>
        <div className="text-lg font-medium text-gray-700 mb-2">
          Haz clic aquí o arrastra tu archivo
        </div>
        <div className="text-sm text-gray-500">
          Soporta: .xlsx, .xls, .csv (hasta 50MB)
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
          <h4 className="font-semibold text-green-800 mb-2">
            📄 Archivo Cargado
          </h4>
          <div className="space-y-1 text-sm text-green-700">
            <p>
              <strong>Nombre:</strong> {fileInfo.name}
            </p>
            <p>
              <strong>Tamaño:</strong> {fileInfo.size}
            </p>
            <p>
              <strong>Tipo:</strong> {fileInfo.type}
            </p>
          </div>
        </div>
      )}

      {fileInfo && !isProcessing && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleProcess}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            🚀 Procesar Archivo
          </button>
          <button
            onClick={clearFile}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            🗑️ Quitar Archivo
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800">
            <div className="animate-spin">⏳</div>
            <span className="font-medium">Procesando archivo...</span>
          </div>
        </div>
      )}
    </div>
  );
}
