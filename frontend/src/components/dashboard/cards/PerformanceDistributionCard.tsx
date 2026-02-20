"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts"
import { useState } from "react"
import { cn } from "@/lib/utils"

const performanceData = [
  { category: "Excellent", count: 23, percentage: 23, color: "#10B981" },
  { category: "Good", count: 45, percentage: 45, color: "#3B82F6" },
  { category: "Average", count: 25, percentage: 25, color: "#F59E0B" },
  { category: "Poor", count: 7, percentage: 7, color: "#EF4444" },
]

const chartData = performanceData.map((item) => ({
  name: item.category,
  value: item.count,
  color: item.color,
}))

export function PerformanceDistributionCard() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className="bg-gradient-to-b from-white to-mint-50/30 border-mint-100 rounded-3xl shadow-[0_2px_8px_rgba(201,244,212,0.12)] hover:shadow-[0_8px_24px_rgba(201,244,212,0.25)] hover:border-mint-200 transition-all">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-semibold text-text-primary">Candidate Performance</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-subtle hover:text-text-primary hover:bg-mint-50">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {/* Chart */}
          <div className="h-[280px] mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <defs>
                  {chartData.map((item, index) => (
                    <linearGradient key={item.name} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={item.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={item.color} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8FAF0" />
                <XAxis
                  dataKey="name"
                  stroke="#2D7A52"
                  fontSize={14}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #C9F4D4",
                    borderRadius: "12px",
                    padding: "12px",
                    boxShadow: "0 4px 16px rgba(201, 244, 212, 0.3)",
                  }}
                  formatter={(value: any) => [`${value} candidates`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartData[0]?.color || "#80EFC0"}
                  strokeWidth={3}
                  fill="url(#gradient-0)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {performanceData.map((item, index) => (
              <motion.button
                key={item.category}
                onClick={() => setSelectedCategory(selectedCategory === item.category ? null : item.category)}
                className={cn(
                  "text-left p-4 rounded-xl border-2 transition-all",
                  selectedCategory === item.category
                    ? "border-mint-200 bg-mint-50 shadow-sm"
                    : "border-transparent hover:border-mint-100 hover:bg-mint-50/50"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[15px] font-semibold text-text-primary">{item.category}</span>
                </div>
                <p className="text-2xl font-bold text-text-primary mb-1">{item.count}</p>
                <p className="text-[14px] text-mint-200">({item.percentage}%)</p>
              </motion.button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

