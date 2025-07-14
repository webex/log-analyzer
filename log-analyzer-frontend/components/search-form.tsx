"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Play } from "lucide-react"

interface SearchFormProps {
  onSearch: (params: any) => void
  loading: boolean
}

const SEARCH_FIELDS = [
  { value: "fields.WEBEX_TRACKINGID.keyword", label: "Webex Tracking ID" },
  { value: "fields.mobiusCallId.keyword", label: "Mobius Call ID" },
  { value: "fields.USER_ID.keyword", label: "User ID" },
  { value: "fields.DEVICE_ID.keyword", label: "Device ID" },
  { value: "fields.WEBEX_MEETING_ID.keyword", label: "Webex Meeting ID" },
  { value: "fields.LOCUS_ID.keyword", label: "Locus ID" },
  { value: "fields.sipCallId.keyword", label: "SIP Call ID"},
  { value: "callId.keyword", label: "Call ID" },
  { value: "traceId.keyword", label: "Trace ID" },
  { value: "sessionId", label: "Session ID" },
  { value: "message", label: "Message" }
]

const TIME_FILTERS = [
  { value: "none", label: "None" },
  { value: "last-15-minutes", label: "Last 15 minutes" },
  { value: "last-30-minutes", label: "Last 30 minutes" },
  { value: "last-1-hour", label: "Last 1 hour" },
  { value: "last-12-hours", label: "Last 12 hours" },
  { value: "last-24-hours", label: "Last 24 hours" },
  { value: "last-3-days", label: "Last 3 days" },
  { value: "last-7-days", label: "Last 7 days" },
  { value: "last-15-days", label: "Last 15 days" }
]

const SERVICES = [
  { value: "mobius", label: "Mobius"},
  { value: "wdm", label: "WDM" },
  { value: "locus", label: "Locus" },
  { value: "mercury", label: "Mercury" },
  { value: "sse", label: "SSE" },
  { value: "mse", label: "MSE" },
]

const LLMS = [
  { value: "gpt-4.1", label: "GPT-4.1" },
  // { value: "gemini", label: "Gemini" },
]


export function SearchForm({ onSearch, loading }: SearchFormProps) {
  const [searchValue, setSearchValue] = useState("")
  const [searchField, setSearchField] = useState("")
  const [timeFilter, setTimeFilter] = useState("")
  const [llm, setLlm] = useState("gpt-4.1")
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  const handleServiceChange = (service: string, checked: boolean) => {
    if (checked) {
      setSelectedServices((prev) => [...prev, service])
    } else {
      setSelectedServices((prev) => prev.filter((s) => s !== service))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    let searchParams = {
      llm,
      searchValue,
      searchField,
      services: selectedServices,
      timeFilter
    }

    onSearch(searchParams)
  }

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-black">
          <Search className="h-5 w-5" />
          Start Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Search Field Selector */}
            <div className="space-y-2">
              <Label htmlFor="searchField" className="text-black font-medium">
                Search Field
              </Label>
              <Select value={searchField} onValueChange={setSearchField}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Select search field" />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LLM Selector */}
            <div className="space-y-2">
              <Label htmlFor="llm" className="text-black font-medium">
                LLM
              </Label>
              <Select value={llm} onValueChange={setLlm}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Select LLM" />
                </SelectTrigger>
                <SelectContent>
                  {LLMS.map((llmOption) => (
                    <SelectItem key={llmOption.value} value={llmOption.value}>
                      {llmOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Filter Selector */}
            <div className="space-y-2">
              <Label htmlFor="timeFilter" className="text-black font-medium">
                Time Filter
              </Label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Select time filter" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Services Selector */}
            <div className="space-y-2">
              <Label className="text-black font-medium">Services</Label>
              <div className="grid grid-cols-4 gap-3 p-2 border border-gray-300 rounded-md">
                {SERVICES.map((service) => (
                  <div key={service.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={service.value}
                      checked={selectedServices.includes(service.value)}
                      onCheckedChange={(checked: boolean) => handleServiceChange(service.value, checked as boolean)}
                    />
                    <Label htmlFor={service.value} className="text-sm text-black cursor-pointer">
                      {service.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="searchValue" className="text-black font-medium">
              Search Value
            </Label>
            <div className="flex gap-3">
              <Input
                id="searchValue"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Enter tracking ID or search value..."
                className="border-gray-300"
                required
              />
              <Button
                type="submit"
                disabled={loading || !searchField || !searchValue}
                className="bg-[#00BCEBFF] text-white hover:bg-[#00BCEB99] px-6"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Start Analysis
                  </div>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
