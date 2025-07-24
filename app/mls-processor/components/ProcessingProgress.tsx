import { Progress } from "../hooks/useMLSProcessor";

interface ProcessingProgressProps {
  progress: Progress;
  onStop: () => void;
}

export function ProcessingProgress({
  progress,
  onStop,
}: ProcessingProgressProps) {
  return (
    <div className="bg-white rounded-xl p-6 mb-8 shadow-sm border">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        ⏳ Processing Progress
      </h3>

      <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        ></div>
      </div>

      <div className="text-gray-600 mb-4">
        Processing {progress.current} of {progress.total} (
        {progress.percentage.toFixed(1)}%) - {progress.currentAddress}
      </div>

      <button
        onClick={onStop}
        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold button-mls-danger"
      >
        ⏹️ Stop Processing
      </button>
    </div>
  );
}
