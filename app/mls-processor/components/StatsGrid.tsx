import { Stats } from "../hooks/useMLSProcessor";

interface StatsGridProps {
  stats: Stats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-3xl font-bold text-blue-600 mb-2">
          {stats.totalProcessed.toLocaleString()}
        </div>
        <div className="text-gray-600 text-sm">Addresses Processed</div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-3xl font-bold text-green-600 mb-2">
          {stats.successRate}
        </div>
        <div className="text-gray-600 text-sm">Success Rate</div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-3xl font-bold text-purple-600 mb-2">
          {stats.geoapifyCount.toLocaleString()}
        </div>
        <div className="text-gray-600 text-sm">Geoapify Calls</div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="text-3xl font-bold text-orange-600 mb-2">
          {stats.geminiCount.toLocaleString()}
        </div>
        <div className="text-gray-600 text-sm">Gemini Calls</div>
      </div>
    </div>
  );
}
