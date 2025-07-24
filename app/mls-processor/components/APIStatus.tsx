interface APIStatusProps {
  mapboxRequestsUsed?: number;
  geoapifyRequestsUsed?: number;
  geminiRequestsUsed?: number;
}

export function APIStatus({
  mapboxRequestsUsed = 0,
  geoapifyRequestsUsed = 0,
  geminiRequestsUsed = 0,
}: APIStatusProps) {
  const mapboxRemaining = 50000 - mapboxRequestsUsed;
  const geoapifyRemaining = 1000 - geoapifyRequestsUsed; // Assuming free tier limit

  return (
    <div className="bg-blue-50 rounded-xl p-6 mb-8 border-l-4 border-blue-500">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        🔑 API Status & Usage
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mapbox API */}
        <div className="bg-white rounded-lg p-4 border-2 border-blue-500 text-center">
          <h4 className="font-semibold text-blue-600 mb-2">🗺️ Mapbox API</h4>
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm mb-2">
            ✅ Primary Geocoding
          </div>
          <div className="text-sm text-gray-600 mb-2">
            <div className="font-semibold text-blue-600 text-lg">
              {mapboxRemaining.toLocaleString()}
            </div>
            <div>requests remaining</div>
            <div className="text-xs">of 50,000 free</div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${((50000 - mapboxRemaining) / 50000) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Geoapify API */}
        <div className="bg-white rounded-lg p-4 border-2 border-green-500 text-center">
          <h4 className="font-semibold text-green-600 mb-2">🌍 Geoapify API</h4>
          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm mb-2">
            ✅ Backup Geocoding
          </div>
          <div className="text-sm text-gray-600 mb-2">
            <div className="font-semibold text-green-600 text-lg">
              {geoapifyRemaining.toLocaleString()}
            </div>
            <div>requests remaining</div>
            <div className="text-xs">of 1,000 free</div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${((1000 - geoapifyRemaining) / 1000) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Gemini API */}
        <div className="bg-white rounded-lg p-4 border-2 border-purple-500 text-center">
          <h4 className="font-semibold text-purple-600 mb-2">🤖 Gemini AI</h4>
          <div className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm mb-2">
            ✅ Smart Enrichment
          </div>
          <div className="text-sm text-gray-600 mb-2">
            <div className="font-semibold text-purple-600 text-lg">
              {geminiRequestsUsed}
            </div>
            <div>requests used</div>
            <div className="text-xs">Pay-per-use</div>
          </div>
          <p className="text-gray-600 text-xs">Neighborhoods & Communities</p>
        </div>
      </div>

      {/* Processing Strategy */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-700 mb-2">
          🔄 Hybrid Processing Strategy
        </h4>
        <div className="text-sm text-gray-600">
          <span className="font-medium">1. Mapbox</span> → Primary geocoding &
          neighborhoods •
          <span className="font-medium"> 2. Property Appraiser</span> → Official
          subdivisions •<span className="font-medium"> 3. Gemini AI</span> →
          Complete missing data
        </div>
      </div>
    </div>
  );
}
