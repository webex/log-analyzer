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
  { value: "fields.sipCallId.keyword", label: "SIP Call ID" },
]

const SERVICES = [
  { value: "mobius", label: "Mobius" },
  { value: "wdm", label: "WDM" },
  { value: "locus", label: "Locus" },
  { value: "mercury", label: "Mercury" },
]

export function SearchForm({ onSearch, loading }: SearchFormProps) {
  const [searchValue, setSearchValue] = useState("")
  const [searchField, setSearchField] = useState("")
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

    const searchParams = {
      searchValue,
      searchField,
      services: selectedServices,
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
        <p className="text-gray-600 text-sm">Enter a tracking ID to begin the multi-agent log analysis process</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            {/* Services Selector */}
            <div className="space-y-2">
              <Label className="text-black font-medium">Services</Label>
              <div className="grid grid-cols-2 gap-3 p-3 border border-gray-300 rounded-md">
                {SERVICES.map((service) => (
                  <div key={service.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={service.value}
                      checked={selectedServices.includes(service.value)}
                      onCheckedChange={(checked) => handleServiceChange(service.value, checked as boolean)}
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
                className="bg-black text-white hover:bg-gray-800 px-6"
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
