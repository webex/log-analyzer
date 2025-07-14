"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, Activity } from "lucide-react";

interface ChartsViewProps {
  results: any;
}

export function ChartsView({ results }: ChartsViewProps) {
  return (
    <div className="text-center py-8 text-gray-500">
      No data available for charts
    </div>
  );
}
