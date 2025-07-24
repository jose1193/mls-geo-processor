import { DetectedColumns, FileData } from "../hooks/useMLSProcessor";

interface ColumnDetectionProps {
  detectedColumns: DetectedColumns;
  fileData: FileData | null;
  onPreviewFile: () => void;
}

export function ColumnDetection({
  detectedColumns,
  fileData,
  onPreviewFile,
}: ColumnDetectionProps) {
  if (!fileData) return null;

  const columnTypes = [
    {
      key: "address" as keyof DetectedColumns,
      label: "📍 Address",
      required: true,
    },
    {
      key: "zip" as keyof DetectedColumns,
      label: "📮 Zip Code",
      required: false,
    },
    {
      key: "city" as keyof DetectedColumns,
      label: "🏙️ City",
      required: false,
    },
    {
      key: "county" as keyof DetectedColumns,
      label: "🏛️ County",
      required: false,
    },
  ];

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-yellow-800">
          🔍 Automatic Column Detection
        </h4>
        <button
          onClick={onPreviewFile}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer"
        >
          👁️ Preview
        </button>
      </div>

      <div className="space-y-3">
        {columnTypes.map((type) => {
          const detected = detectedColumns[type.key];
          const isDetected = detected !== null;

          return (
            <div
              key={type.key}
              className={`p-3 rounded-lg border transition-colors ${
                isDetected
                  ? "border-green-300 bg-green-50"
                  : "border-red-300 bg-red-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-gray-800">{type.label}:</strong>
                  <span
                    className={`ml-2 ${
                      isDetected ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {isDetected ? `✅ ${detected}` : "❌ Not detected"}
                  </span>
                </div>
                <span className="text-xs text-gray-600">
                  {type.required ? "(Required)" : "(Optional)"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>📊 Columns available in the file:</strong>
          <div className="mt-2 flex flex-wrap gap-2">
            {fileData.columns.map((col, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
