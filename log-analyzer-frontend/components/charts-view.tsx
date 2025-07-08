"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, PieChart, Activity } from "lucide-react"

interface ChartsViewProps {
  results: any
}

export function ChartsView({ results }: ChartsViewProps) {
  if (!results) {
    return <div className="text-center py-8 text-gray-500">No data available for charts</div>
  }

  const logs = results.hits?.hits || []

  // Process data for charts
  const timeDistribution = logs.reduce((acc: any, log: any) => {
    const timestamp = new Date(log._source["@timestamp"])
    const hour = timestamp.getHours()
    acc[hour] = (acc[hour] || 0) + 1
    return acc
  }, {})

  const logLevels = logs.reduce((acc: any, log: any) => {
    const level = log._source?.log_level || "UNKNOWN"
    acc[level] = (acc[level] || 0) + 1
    return acc
  }, {})

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Log Level Distribution */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-black flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Log Level Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(logLevels).map(([level, count]) => {
              const percentage = (((count as number) / logs.length) * 100).toFixed(1)
              return (
                <div key={level} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-black font-medium">{level}</span>
                    <span className="text-gray-600">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-black h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Time Distribution */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-black flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Hourly Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(timeDistribution)
              .sort(([a], [b]) => Number.parseInt(a) - Number.parseInt(b))
              .map(([hour, count]) => {
                const maxCount = Math.max(...(Object.values(timeDistribution) as number[]))
                const percentage = ((count as number) / maxCount) * 100
                return (
                  <div key={hour} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-8">{hour.padStart(2, "0")}:00</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-black h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-black font-medium w-8">{count}</span>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card className="border-gray-200 md:col-span-2">
        <CardHeader>
          <CardTitle className="text-black flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-black">{results.took}ms</div>
              <div className="text-sm text-gray-600">Query Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-black">{results._shards?.total || 0}</div>
              <div className="text-sm text-gray-600">Total Shards</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-black">{results.hits?.total?.value || 0}</div>
              <div className="text-sm text-gray-600">Total Hits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-black">{results.hits?.max_score?.toFixed(2) || "0.00"}</div>
              <div className="text-sm text-gray-600">Max Score</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
