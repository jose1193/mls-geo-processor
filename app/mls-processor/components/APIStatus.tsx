import type { APILimits, Stats } from "../hooks/useMLSProcessor";

interface APIStatusProps {
  apiLimits: APILimits;
  stats: Stats;
}

export function APIStatus({ apiLimits, stats }: APIStatusProps) {
  // Calcula los valores en tiempo real usando los stats actuales
  const mapboxUsed = stats.mapboxCount;
  const geocodioUsed = stats.geocodioCount;
  const geminiUsed = stats.geminiCount;
  const mapboxRemaining = apiLimits.mapbox - mapboxUsed;
  const geocodioRemaining = apiLimits.geocodio - geocodioUsed;
  const geminiRemaining = apiLimits.gemini - geminiUsed;
  const mapboxPercentage = Math.round((mapboxUsed / apiLimits.mapbox) * 100);
  const geocodioPercentage = Math.round(
    (geocodioUsed / apiLimits.geocodio) * 100
  );
  const geminiPercentage = Math.round((geminiUsed / apiLimits.gemini) * 100);

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "red";
    if (percentage >= 75) return "yellow";
    return "green";
  };

  const getStatusText = (percentage: number) => {
    if (percentage >= 90) return "⚠️ Critical";
    if (percentage >= 75) return "⚠️ Warning";
    return "✅ Normal";
  };

  return (
    <div className="bg-blue-50 rounded-xl p-6 mb-8 border-l-4 border-blue-500">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        🔑 API Status & Usage Limits
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mapbox API */}
        <div
          className={`bg-white rounded-lg p-4 border-2 text-center ${
            getStatusColor(mapboxPercentage) === "red"
              ? "border-red-500"
              : getStatusColor(mapboxPercentage) === "yellow"
              ? "border-yellow-500"
              : "border-blue-500"
          }`}
        >
          <h4
            className={`font-semibold mb-2 ${
              getStatusColor(mapboxPercentage) === "red"
                ? "text-red-600"
                : getStatusColor(mapboxPercentage) === "yellow"
                ? "text-yellow-600"
                : "text-blue-600"
            }`}
          >
            🗺️ Mapbox API
          </h4>
          <div
            className={`text-white px-3 py-1 rounded-full text-sm mb-2 ${
              getStatusColor(mapboxPercentage) === "red"
                ? "bg-red-500"
                : getStatusColor(mapboxPercentage) === "yellow"
                ? "bg-yellow-500"
                : "bg-blue-500"
            }`}
          >
            {getStatusText(mapboxPercentage)}
          </div>
          <div className="text-sm text-gray-600 mb-2">
            <div
              className={`font-semibold text-lg ${
                getStatusColor(mapboxPercentage) === "red"
                  ? "text-red-600"
                  : getStatusColor(mapboxPercentage) === "yellow"
                  ? "text-yellow-600"
                  : "text-blue-600"
              }`}
            >
              {mapboxRemaining.toLocaleString()}
            </div>
            <div>remaining</div>
            <div className="text-xs">
              {mapboxUsed.toLocaleString()} /{" "}
              {apiLimits.mapbox.toLocaleString()} used ({mapboxPercentage}%)
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                getStatusColor(mapboxPercentage) === "red"
                  ? "bg-red-500"
                  : getStatusColor(mapboxPercentage) === "yellow"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(mapboxPercentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-gray-600 text-xs mt-2">Primary Geocoding</p>
        </div>

        {/* Geocodio API */}
        <div
          className={`bg-white rounded-lg p-4 border-2 text-center ${
            getStatusColor(geocodioPercentage) === "red"
              ? "border-red-500"
              : getStatusColor(geocodioPercentage) === "yellow"
              ? "border-yellow-500"
              : "border-green-500"
          }`}
        >
          <h4
            className={`font-semibold mb-2 ${
              getStatusColor(geocodioPercentage) === "red"
                ? "text-red-600"
                : getStatusColor(geocodioPercentage) === "yellow"
                ? "text-yellow-600"
                : "text-green-600"
            }`}
          >
            🌍 Geocodio API
          </h4>
          <div
            className={`text-white px-3 py-1 rounded-full text-sm mb-2 ${
              getStatusColor(geocodioPercentage) === "red"
                ? "bg-red-500"
                : getStatusColor(geocodioPercentage) === "yellow"
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
          >
            {getStatusText(geocodioPercentage)}
          </div>
          <div className="text-sm text-gray-600 mb-2">
            <div
              className={`font-semibold text-lg ${
                getStatusColor(geocodioPercentage) === "red"
                  ? "text-red-600"
                  : getStatusColor(geocodioPercentage) === "yellow"
                  ? "text-yellow-600"
                  : "text-green-600"
              }`}
            >
              {geocodioRemaining.toLocaleString()}
            </div>
            <div>remaining</div>
            <div className="text-xs">
              {geocodioUsed.toLocaleString()} /{" "}
              {apiLimits.geocodio.toLocaleString()} used ({geocodioPercentage}%)
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                getStatusColor(geocodioPercentage) === "red"
                  ? "bg-red-500"
                  : getStatusColor(geocodioPercentage) === "yellow"
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${Math.min(geocodioPercentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-gray-600 text-xs mt-2">Backup Geocoding</p>
        </div>

        {/* Gemini API */}
        <div
          className={`bg-white rounded-lg p-4 border-2 text-center ${
            getStatusColor(geminiPercentage) === "red"
              ? "border-red-500"
              : getStatusColor(geminiPercentage) === "yellow"
              ? "border-yellow-500"
              : "border-purple-500"
          }`}
        >
          <h4
            className={`font-semibold mb-2 ${
              getStatusColor(geminiPercentage) === "red"
                ? "text-red-600"
                : getStatusColor(geminiPercentage) === "yellow"
                ? "text-yellow-600"
                : "text-purple-600"
            }`}
          >
            🤖 Gemini AI
          </h4>
          <div
            className={`text-white px-3 py-1 rounded-full text-sm mb-2 ${
              getStatusColor(geminiPercentage) === "red"
                ? "bg-red-500"
                : getStatusColor(geminiPercentage) === "yellow"
                ? "bg-yellow-500"
                : "bg-purple-500"
            }`}
          >
            {getStatusText(geminiPercentage)}
          </div>
          <div className="text-sm text-gray-600 mb-2">
            <div
              className={`font-semibold text-lg ${
                getStatusColor(geminiPercentage) === "red"
                  ? "text-red-600"
                  : getStatusColor(geminiPercentage) === "yellow"
                  ? "text-yellow-600"
                  : "text-purple-600"
              }`}
            >
              {geminiRemaining.toLocaleString()}
            </div>
            <div>remaining</div>
            <div className="text-xs">
              {geminiUsed.toLocaleString()} /{" "}
              {apiLimits.gemini.toLocaleString()} used ({geminiPercentage}%)
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                getStatusColor(geminiPercentage) === "red"
                  ? "bg-red-500"
                  : getStatusColor(geminiPercentage) === "yellow"
                  ? "bg-yellow-500"
                  : "bg-purple-500"
              }`}
              style={{ width: `${Math.min(geminiPercentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-gray-600 text-xs mt-2">Smart Enrichment</p>
        </div>
      </div>

      {/* Processing Strategy */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-700 mb-2">
          🔄 Smart Processing Strategy with Limits
        </h4>
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-medium">1. Mapbox Primary</span> → Geocoding +
            neighborhoods (if available)
          </div>
          <div>
            <span className="font-medium">2. Gemini Enhancement</span> → Only
            called if Mapbox lacks neighborhoods
          </div>
          <div>
            <span className="font-medium">3. Geocodio Fallback</span> → Only if
            Mapbox completely fails
          </div>
          <div className="mt-2 p-2 bg-yellow-50 rounded border-l-2 border-yellow-400">
            <span className="font-medium text-yellow-700">⚠️ Auto-Stop:</span>{" "}
            Processing stops when any API limit is reached
          </div>
        </div>
      </div>
    </div>
  );
}
