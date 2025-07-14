"use client";

import { useState } from "react";
import { SearchForm } from "@/components/search-form";
import { ResultsTabs } from "@/components/results-tabs";
import { SessionManager } from "@/lib/session-manager";

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

      const logs = events[1]?.content?.parts?.flatMap((part: any) => JSON.parse(part.functionResponse?.response?.result?.content?.[0]?.text).hits.hits)
    
      setResults(logs);

      console.log("Search results:", logs);

      console.log("Results count:", logs?.length);

      const analysis = events[3]?.content?.parts?.[0]?.text;
      setAnalysis(analysis);

      const mermaidCode = events[4]?.content?.parts?.[0]?.text;
      setMermaidCode(mermaidCode);


      // Process events to extract results and analysis
      // const lastEvent = events[events.length - 1]
      // if (lastEvent?.content?.parts?.[0]?.text) {
      //   try {
      //     const parsed = JSON.parse(lastEvent.content.parts[0].text)
      //     if (parsed.logs) {
      //       setResults(parsed.logs)
      //     }
      //     if (parsed.analysis) {
      //       setAnalysis(parsed.analysis)
      //     }
      //   } catch {
      //     // If not JSON, treat as analysis text
      //     setAnalysis(lastEvent.content.parts[0].text)
      //   }
      // }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black mb-2">
            Log Analysis Dashboard
          </h1>
          <p className="text-gray-600">
            Multi-Agent System for Microservice Log Analysis
          </p>
        </div>

        {/* Search Form */}
        <SearchForm onSearch={handleSearch} loading={loading} />

        {/* Results */}
        {(results || analysis || mermaidCode) && (
          <div className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-2">
                Analysis Results
              </h2>
              <p className="text-gray-600">
                Complete analysis results for your query
              </p>
            </div>
            <ResultsTabs results={results} analysis={analysis} mermaidCode={mermaidCode} />
          </div>
        )}
      </div>
    </div>
  );
}
