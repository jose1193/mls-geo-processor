"use client";

import { useState, useRef } from "react";

interface FileUploadProps {
  onProcessFile: (file: File) => void;
  isProcessing: boolean;
}

export function FileUpload({ onProcessFile, isProcessing }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: string;
    rows: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
    setFileInfo({
      name: file.name,
      size: `${sizeInMB} MB`,
      rows: Math.floor(Math.random() * 1000) + 100, // Mock row count
    });
  };

  const handleProcess = () => {
    if (fileInputRef.current?.files?.[0]) {
      onProcessFile(fileInputRef.current.files[0]);
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl p-6 mb-8 border-l-4 border-blue-500">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        📤 Upload Excel/CSV File
      </h3>

      <div
        className={`border-3 border-dashed rounded-xl p-8 text-center bg-white transition-all cursor-pointer
          ${isDragOver ? "border-blue-500 bg-blue-50" : "border-blue-300"}
          hover:border-blue-500 hover:bg-blue-50`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-6xl text-blue-500 mb-4">📊</div>
        <div className="text-lg font-semibold text-gray-700 mb-2">
          Click here or drag your file
        </div>
        <div className="text-gray-500">
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
        <div className="bg-green-50 rounded-lg p-4 mt-4 border-l-4 border-green-500">
          <h4 className="font-semibold text-green-700 mb-2">
            📄 Archivo Cargado
          </h4>
          <p className="text-sm text-gray-600">Nombre: {fileInfo.name}</p>
          <p className="text-sm text-gray-600">Tamaño: {fileInfo.size}</p>
          <p className="text-sm text-gray-600">
            Filas detectadas: {fileInfo.rows.toLocaleString()}
          </p>
        </div>
      )}

      <div className="flex gap-4 mt-6">
        <button
          onClick={handleProcess}
          disabled={!fileInfo || isProcessing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          🚀 Procesar Archivo Automáticamente
        </button>

        <button
          onClick={() => {
            /* Preview functionality */
          }}
          disabled={!fileInfo}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          👁️ Vista Previa
        </button>
      </div>
    </div>
  );
}
