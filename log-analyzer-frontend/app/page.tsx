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
      await sessionManager.ensureSession();

      setResults(null);
      setAnalysis("");
      setMermaidCode("");

      const events = await sessionManager.sendQuery(searchParams);
      console.log("Search events received:", events);


      let logs: any[] = [];
      let extractedAnalysis = "";
      let extractedMermaid = "";

      events.forEach((event: any, iter: number) => {
        const author = event.author;
        const parts = event.content?.parts || [];

        // Extract logs from search_agent
        if ((author === "wxm_search_agent" || author === "wxcalling_search_agent" || author === "wxcas_search_agent") && (parts.length > 0 && parts[0].functionResponse)) {
          console.log(`Processing logs from ${author} at event index ${iter}`);
          parts.forEach((part: any) => {
            try {
              const hits = JSON.parse(
                part.functionResponse?.response?.content?.[0]?.text || "{}"
              )?.hits?.hits;
              if (hits) logs.push(...hits);
            } catch (error) {
              console.error("Failed to parse log entry:", error);
            }
          });
        }

        // Extract analysis from analyze_agent
        if ((author === "calling_agent" || author === "contact_center_agent") && !extractedAnalysis) {
          extractedAnalysis = parts[0]?.text || "";
        }

        // Extract Mermaid sequence diagram from sequence_diagram_agent
        if (author === "sequence_diagram_agent" && !extractedMermaid) {
          extractedMermaid = parts[0]?.text || "";
        }

      }); 

      console.log("Combined Logs:", logs);
      
      setResults(logs);
      setAnalysis(extractedAnalysis);
      setMermaidCode(extractedMermaid);

      console.log("Parsed Results:", logs);
      console.log("Analysis:", extractedAnalysis);
      console.log("Mermaid Code:", extractedMermaid);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
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

          {/* {results && results.length === 0 && !loading && (
            <div className="mt-12 text-center text-gray-500">
              No results found for your query :(
            </div>
          )} */}

          {analysis !== "" && (
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



//old code
// "use client";

// import { useState } from "react";
// import { SearchForm } from "@/components/search-form";
// import { ResultsTabs } from "@/components/results-tabs";
// import { SessionManager } from "@/lib/session-manager";
// import { Card } from "@/components/ui/card";

// export default function HomePage() {
//   const [results, setResults] = useState<any>(null);
//   const [analysis, setAnalysis] = useState<string>("");
//   const [mermaidCode, setMermaidCode] = useState<string>("");
//   const [loading, setLoading] = useState(false);
//   const [sessionManager] = useState(() => new SessionManager());

//   const handleSearch = async (searchParams: any) => {
//     setLoading(true);
//     try {
//       // Ensure session exists
//       await sessionManager.ensureSession();

//       setResults(null);
//       setAnalysis("");
//       setMermaidCode("");
//       // Send query using the session manager
//       const events = await sessionManager.sendQuery(searchParams);

//       console.log("Search events received:", events);

//       const logs = events[1]?.content?.parts?.flatMap((part: any, i: number) => {
//         try {
//           const rawText = part.functionResponse?.response?.result?.content?.[0]?.text;
//           console.log(`Raw search result [${i}]:`, rawText);

//           if (!rawText) return [];

//           const parsed = JSON.parse(rawText);
//           console.log(`Parsed search result [${i}]:`, parsed);

//           // Return hits or empty
//           return parsed?.hits?.hits || [];
//         } catch (error) {
//           console.error("Failed to parse log entry:", error, part);
//           return [];
//         }
//       }) || [];

//       console.log("Final combined logs:", logs);




//       setResults(logs);

//       console.log("Search results:", logs);

//       console.log("Results count:", logs?.length);

//       const analysis = events[3]?.content?.parts?.[0]?.text;
//       setAnalysis(analysis);

//       const mermaidCode = events[4]?.content?.parts?.[0]?.text;
//       setMermaidCode(mermaidCode);
//     } catch (error) {
//       console.error("Search failed:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     // div strectch to full height and width no scrollbars
//     <div className="h-screen flex flex-row gap-0 overflow-hidden">
//       <div className="w-1/4 p-3">
//         <SearchForm onSearch={handleSearch} loading={loading} />
//       </div>
//       <div className="flex flex-1 p-3">
//         <Card className="border-gray-200 flex flex-1 items-center justify-center">
//           {!results && !loading && (
//             <div className="mt-12 text-center text-gray-500">
//               Start searching :)
//             </div>
//           )}

//           {loading && (
//             <div className="mt-12 text-center text-gray-500">
//               Loading results...
//             </div>
//           )}

//           {results && results.length === 0 && !loading && (
//             <div className="mt-12 text-center text-gray-500">
//               No results found for your query :(
//             </div>
//           )}

//           {results && analysis && mermaidCode && results.length > 0 && (
//             <ResultsTabs
//               results={results}
//               analysis={analysis}
//               mermaidCode={mermaidCode}
//             />
//           )}
//         </Card>
//       </div>
//     </div>
//   );
// }
