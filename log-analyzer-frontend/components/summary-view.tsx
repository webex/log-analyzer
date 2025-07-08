"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Layers, TrendingUp } from "lucide-react"

interface SummaryViewProps {
  results: any
}

export function SummaryView({ results }: SummaryViewProps) {
  if (!results) {
    return <div className="text-center py-8 text-gray-500">No results to display</div>
  }

  const totalHits = results.hits?.total?.value || 0
  const maxScore = results.hits?.max_score || 0
  const took = results.took || 0
  const shards = results._shards || {}

  // Calculate some basic metrics from the logs
  const logs = results.hits?.hits || []
  const logLevels = logs.reduce((acc: any, log: any) => {
    const level = log._source?.log_level || "UNKNOWN"
    acc[level] = (acc[level] || 0) + 1
    return acc
  }, {})

  const services = logs.reduce((acc: any, log: any) => {
    const tags = log._source?.tags || []
    tags.forEach((tag: string) => {
      acc[tag] = (acc[tag] || 0) + 1
    })
    return acc
  }, {})

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Transaction Overview */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-black">Transaction Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Status:</span>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Duration:</span>
            <span className="text-black font-mono">{took}ms</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Services Involved:</span>
            <span className="text-black font-bold">{Object.keys(services).length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Total Logs:</span>
            <span className="text-black font-bold">{totalHits}</span>
          </div>
        </CardContent>
      </Card>

      {/* Health Metrics */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-black">Health Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Success Rate:</span>
            <span className="text-green-600 font-bold">{((shards.successful / shards.total) * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Max Score:</span>
            <span className="text-black font-mono">{maxScore.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Error Count:</span>
            <span className="text-red-600 font-bold">{logLevels.ERROR || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Warning Count:</span>
            <span className="text-yellow-600 font-bold">{logLevels.WARN || 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* Log Level Distribution */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-black flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Log Level Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(logLevels).map(([level, count]) => (
              <div key={level} className="flex justify-between items-center">
                <Badge variant="outline" className="text-black">
                  {level}
                </Badge>
                <span className="text-black font-bold">{count as number}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-black flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Services Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(services)
              .slice(0, 5)
              .map(([service, count]) => (
                <div key={service} className="flex justify-between items-center">
                  <span className="text-gray-700">{service}</span>
                  <span className="text-black font-bold">{count as number}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
