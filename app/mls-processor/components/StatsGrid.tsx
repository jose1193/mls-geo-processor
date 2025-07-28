import { Stats } from "../hooks/useMLSProcessor";

interface StatsGridProps {
  stats: Stats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-2xl font-bold text-blue-600 mb-2">
          {stats.totalProcessed.toLocaleString()}
        </div>
        <div className="text-gray-600 text-sm">Addresses Processed</div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-2xl font-bold text-green-600 mb-2">
          {stats.successRate}
        </div>
        <div className="text-gray-600 text-sm">Success Rate</div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-2xl font-bold text-indigo-600 mb-2">
          {stats.mapboxCount.toLocaleString()}
        </div>
        <div className="text-gray-600 text-sm">Mapbox Calls</div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-2xl font-bold text-purple-600 mb-2">
          {stats.geocodioCount.toLocaleString()}
        </div>
        <div className="text-gray-600 text-sm">Geocodio Calls</div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-2xl font-bold text-orange-600 mb-2">
          {stats.geminiCount.toLocaleString()}
        </div>
        <div className="text-gray-600 text-sm">Gemini Calls</div>
      </div>
    </div>
  );
}
