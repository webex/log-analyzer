"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogCard } from "@/components/log-card"
import { AnalysisView } from "@/components/analysis-view"
import { SummaryView } from "@/components/summary-view"
import { ChartsView } from "@/components/charts-view"

interface ResultsTabsProps {
  results: any
  analysis: string
}

export function ResultsTabs({ results, analysis }: ResultsTabsProps) {
  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList className="grid w-full grid-cols-4 bg-gray-100">
        <TabsTrigger value="summary" className="text-black data-[state=active]:bg-white">
          Summary
        </TabsTrigger>
        <TabsTrigger value="logs" className="text-black data-[state=active]:bg-white">
          Raw Logs
        </TabsTrigger>
        <TabsTrigger value="analysis" className="text-black data-[state=active]:bg-white">
          Analysis
        </TabsTrigger>
        <TabsTrigger value="charts" className="text-black data-[state=active]:bg-white">
          Charts
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="mt-6">
        <SummaryView results={results} />
      </TabsContent>

      <TabsContent value="logs" className="mt-6">
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {results?.hits?.hits?.map((hit: any, index: number) => (
            <LogCard key={hit._id || index} log={hit} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="analysis" className="mt-6">
        <AnalysisView analysis={analysis} />
      </TabsContent>

      <TabsContent value="charts" className="mt-6">
        <ChartsView results={results} />
      </TabsContent>
    </Tabs>
  )
}
