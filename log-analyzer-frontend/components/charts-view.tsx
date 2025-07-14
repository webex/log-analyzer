"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface ChartsViewProps {
  mermaidCode: string;
}

export function ChartsView({ mermaidCode }: ChartsViewProps) {

  if (!mermaidCode) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No diagram data available</p>
      </div>
    );
  }
  
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize mermaid with configuration
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        mirrorActors: true,
        bottomMarginAdj: 1,
        useMaxWidth: true,
        rightAngles: false,
        showSequenceNumbers: false,
      },
      flowchart: {
        useMaxWidth: true,
      },
      themeVariables: {
        primaryColor: "#3b82f6",
        primaryTextColor: "#1f2937",
        primaryBorderColor: "#e5e7eb",
        lineColor: "#6b7280",
        secondaryColor: "#f3f4f6",
        tertiaryColor: "#ffffff",
      },
    });

    // Render the diagram
    const renderDiagram = async () => {
      if (mermaidRef.current && mermaidCode) {
        try {
          // Clear previous content
          mermaidRef.current.innerHTML = "";
          
          // Generate unique ID for the diagram
          const id = `mermaid-${Date.now()}`;
          
          const cleanedCode = mermaidCode.replaceAll(";", " - ");
          // Validate and render the mermaid code
          const { svg } = await mermaid.render(id, cleanedCode);
          mermaidRef.current.innerHTML = svg;
        } catch (error) {
          console.error("Mermaid rendering error:", error);
          mermaidRef.current.innerHTML = `
            <div class="text-red-500 p-4 border border-red-200 rounded">
              <p class="font-semibold">Error rendering diagram:</p>
              <p class="text-sm mt-1">${error instanceof Error ? error.message : 'Unknown error'}</p>
              <details class="mt-2">
                <summary class="cursor-pointer text-xs">Raw Mermaid Code</summary>
                <pre class="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">${mermaidCode}</pre>
              </details>
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [mermaidCode]);

  return (
    <div className="py-8">
      <div className="w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Sequence Diagram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-auto">
              {mermaidCode.trim() ? (
                <div ref={mermaidRef} className="flex justify-center" />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No diagram data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
