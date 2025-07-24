import { LogEntry } from "../hooks/useMLSProcessor";

interface LogsPanelProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export function LogsPanel({ logs, onClearLogs }: LogsPanelProps) {
  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "text-green-600 bg-green-50 border-green-200";
      case "error":
        return "text-red-600 bg-red-50 border-red-200";
      case "warning":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default:
        return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 mb-8 shadow-sm border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          📋 Processing Logs
        </h3>
        <button
          onClick={onClearLogs}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold button-mls"
        >
          🗑️ Clear Logs
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-4 bg-gray-50">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`p-3 rounded-lg border ${getLogColor(log.type)}`}
          >
            <span className="text-xs font-mono text-gray-500 mr-2">
              {log.timestamp}:
            </span>
            <span className="text-sm">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
