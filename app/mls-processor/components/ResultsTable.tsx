import { ProcessedResult } from "../hooks/useMLSProcessor";
import { useState, useMemo } from "react";

interface ResultsTableProps {
  results: ProcessedResult[];
  onDownloadResults: () => void;
  onClearResults: () => void;
}

export function ResultsTable({
  results,
  onDownloadResults,
  onClearResults,
}: ResultsTableProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Calculate pagination
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = useMemo(
    () => results.slice(startIndex, endIndex),
    [results, startIndex, endIndex]
  );

  // Navigation functions
  const goToFirst = () => setCurrentPage(1);
  const goToLast = () => setCurrentPage(totalPages);
  const goToPrevious = () => setCurrentPage(Math.max(1, currentPage - 1));
  const goToNext = () => setCurrentPage(Math.min(totalPages, currentPage + 1));

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            📊 Processing Results
          </h3>
        </div>
        <div className="text-center text-gray-500 py-12">
          No results yet. Upload a file to begin.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      {/* Header with controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">
            📊 Processing Results
          </h3>
          <div className="text-sm text-gray-600">
            Total:{" "}
            <span className="font-semibold text-blue-600">
              {results.length.toLocaleString()}
            </span>{" "}
            records
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onDownloadResults}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold button-mls-success"
          >
            💾 Download Results
          </button>
          <button
            onClick={onClearResults}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold button-mls-danger"
          >
            🗑️ Clear Results
          </button>
        </div>
      </div>

      {/* Pagination controls top */}
      <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Show:
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="ml-2 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </label>
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, results.length)} of{" "}
            {results.length.toLocaleString()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToFirst}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⏪ First
          </button>
          <button
            onClick={goToPrevious}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⬅️ Prev
          </button>

          <span className="px-3 py-1 text-sm font-medium">
            Page {currentPage} of {totalPages.toLocaleString()}
          </span>

          <button
            onClick={goToNext}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next ➡️
          </button>
          <button
            onClick={goToLast}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last ⏩
          </button>
        </div>
      </div>

      {/* Table with fixed height and scroll */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[1400px]">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-20">
                  ML#
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-60">
                  Address
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-24">
                  Zip Code
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-32">
                  City Name
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-28">
                  County
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-24">
                  House Number
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-28">
                  Latitude
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-28">
                  Longitude
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-48">
                  Neighborhoods
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-48">
                  Communities
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-24">
                  Status
                </th>
                <th className="border-b border-gray-300 px-4 py-4 text-center text-sm font-semibold text-gray-900 uppercase tracking-wider w-40">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentResults.map((result, index) => {
                // Defensive: handle any undefined entries that might appear due to pre-allocation
                if (!result) {
                  return (
                    <tr key={startIndex + index} className="bg-red-50">
                      <td
                        colSpan={12}
                        className="px-4 py-4 text-sm text-red-700 text-center font-medium"
                      >
                        ⚠️ Missing result data (index {startIndex + index})
                      </td>
                    </tr>
                  );
                }
                const mlId =
                  result?.["ML#"] ||
                  result?.["MLS#"] ||
                  result?.["MLSNumber"] ||
                  result?.["MLS Number"] ||
                  result?.["ListingID"] ||
                  result?.["Listing ID"] ||
                  "N/A";
                return (
                  <tr
                    key={startIndex + index}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4 text-sm text-gray-900 font-medium text-center">
                      {mlId}
                    </td>
                    <td
                      className="px-4 py-4 text-sm text-gray-900 truncate text-center"
                      title={String(
                        result?.["Address"] || result.original_address || "N/A"
                      )}
                    >
                      {result?.["Address"] || result.original_address || "N/A"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 text-center">
                      {result?.["Zip Code"] || "N/A"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 text-center">
                      {result?.["City Name"] || "N/A"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 text-center">
                      {result?.["County"] || "N/A"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 text-center">
                      {result?.["House Number"] || "N/A"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 font-mono text-center">
                      {result.latitude?.toFixed(6) || "N/A"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 font-mono text-center">
                      {result.longitude?.toFixed(6) || "N/A"}
                    </td>
                    <td
                      className="px-4 py-4 text-sm truncate text-center"
                      title={result.neighborhoods || "N/A"}
                    >
                      <span
                        className={
                          result.neighborhoods
                            ? "text-green-600 font-semibold"
                            : "text-gray-400"
                        }
                      >
                        {result.neighborhoods || "N/A"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-4 text-sm truncate text-center"
                      title={result.comunidades || "N/A"}
                    >
                      <span
                        className={
                          result.comunidades
                            ? "text-green-600 font-semibold"
                            : "text-gray-400"
                        }
                      >
                        {result.comunidades || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          result.status === "success"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {result.status === "success"
                          ? "✅ Success"
                          : "❌ Error"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-4 text-sm text-gray-900 truncate text-center"
                      title={result.api_source || "N/A"}
                    >
                      {result.api_source || "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination controls bottom */}
      <div className="flex justify-between items-center mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(endIndex, results.length)} of{" "}
          {results.length.toLocaleString()} entries
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToFirst}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⏪
          </button>
          <button
            onClick={goToPrevious}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⬅️
          </button>

          {/* Page number input */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Page</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage.toString()}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= totalPages) {
                  setCurrentPage(page);
                }
              }}
              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
            />
            <span className="text-sm">of {totalPages.toLocaleString()}</span>
          </div>

          <button
            onClick={goToNext}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ➡️
          </button>
          <button
            onClick={goToLast}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⏩
          </button>
        </div>
      </div>
    </div>
  );
}
