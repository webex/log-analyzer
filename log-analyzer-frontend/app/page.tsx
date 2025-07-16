"use client";

import { useState } from "react";
import { SearchForm } from "@/components/search-form";
import { ResultsTabs } from "@/components/results-tabs";
import { SessionManager } from "@/lib/session-manager";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  const [results, setResults] = useState<any>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sessionManager] = useState(() => new SessionManager());

  const handleSearch = async (searchParams: any) => {
    setLoading(true);
    try {
      // Ensure session exists
      await sessionManager.ensureSession();

      setResults(null);
      setAnalysis("");
      setMermaidCode("");
      // Send query using the session manager
      const events = await sessionManager.sendQuery(searchParams);

      console.log("Search events received:", events);

      const logs = events[1]?.content?.parts?.flatMap(
        (part: any) =>
          {
            try {
              return JSON.parse(
            part.functionResponse?.response?.result?.content?.[0]?.text
          ).hits.hits;
            } catch (error) {
              console.error("Failed to parse log entry:", error);
              return [];
            }
          }
      );

      setResults(logs);

      console.log("Search results:", logs);

      console.log("Results count:", logs?.length);

      const analysis = events[3]?.content?.parts?.[0]?.text;
      setAnalysis(analysis);

      const mermaidCode = events[4]?.content?.parts?.[0]?.text;
      setMermaidCode(mermaidCode);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // div strectch to full height and width no scrollbars
    <div className="h-screen flex flex-row gap-0 overflow-hidden">
      <div className="w-1/4 p-3">
        <SearchForm onSearch={handleSearch} loading={loading} />
      </div>
      <div className="flex flex-1 p-3">
        <Card className="border-gray-200 flex flex-1 items-center justify-center">
          {!results && !loading && (
            <div className="mt-12 text-center text-gray-500">
              Start searching :)
            </div>
          )}

          {loading && (
            <div className="mt-12 text-center text-gray-500">
              Loading results...
            </div>
          )}

          {results && results.length === 0 && !loading && (
            <div className="mt-12 text-center text-gray-500">
              No results found for your query :(
            </div>
          )}

          {results && analysis && mermaidCode && results.length > 0 && (
            <ResultsTabs
              results={results}
              analysis={analysis}
              mermaidCode={mermaidCode}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
