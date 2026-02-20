"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts"

const chartData = [
  { day: "1", value: 45 },
  { day: "5", value: 52 },
  { day: "10", value: 48 },
  { day: "15", value: 61 },
  { day: "20", value: 55 },
  { day: "25", value: 68 },
  { day: "30", value: 72 },
]

export function MiniChartCard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className="h-full bg-gradient-to-b from-white to-mint-50/30 border-mint-100 rounded-2xl shadow-[0_2px_8px_rgba(201,244,212,0.12)] hover:shadow-[0_8px_24px_rgba(201,244,212,0.25)] hover:border-mint-200 transition-all">
        <CardContent className="p-6 h-full flex flex-col">
          <p className="text-sm font-medium text-text-secondary mb-4">30-Day Trend</p>
          <div className="flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="miniChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9F4D4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#C9F4D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #C9F4D4",
                    borderRadius: "8px",
                    padding: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#80EFC0"
                  strokeWidth={2}
                  fill="url(#miniChartGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

