import { motion } from "framer-motion"
import {
  Users,
  Award,
  BookOpen,
  Zap,
  Trophy,
  Crown,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Search,
  FileText,
  UserPlus,
  BarChart3,
  ArrowRight,
  ChevronRight,
  MoreVertical,
  AlertCircle,
  Building2,
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import { useUserProfile } from "@/hooks/auth"
import { useOrganization } from "@/hooks/api/useOrganization"
import { useEmployees } from "@/hooks/api/useEmployees"

export function EmployeeDashboard() {
  const router = useRouter()
  const { data: session } = useSession()
  const { data: userProfile } = useUserProfile()
  const user = (session as any)?.user
  
  // Get orgId from user profile or session
  const orgId = (userProfile as any)?.orgId || (user as any)?.orgId || (user as any)?.organization
  
  // Fetch organization details from database using orgId
  const { data: organization } = useOrganization(orgId)
  
  // Fetch employee count (using limit=1 to minimize data transfer, we only need the total count)
  const { data: employeesData } = useEmployees({ page: 1, limit: 1 })
  const totalEmployees = employeesData?.pagination?.total || 0
  
  // Get admin name
  const adminName = userProfile?.name || user?.name || "Admin"
  
  // Get organization name
  const orgName = organization?.name || orgId || "your organization"

  // Skill distribution data
  const skillDistributionData = [
    { name: "Expert", value: 23, color: "#10B981" },
    { name: "Advanced", value: 45, color: "#3B82F6" },
    { name: "Intermediate", value: 25, color: "#F59E0B" },
    { name: "Beginner", value: 7, color: "#EF4444" },
  ]

  // Top performers data
  const topPerformers = [
    { rank: 1, name: "John Doe", role: "Full Stack Developer", score: 94, improvement: 13 },
    { rank: 2, name: "Jane Smith", role: "Backend Developer", score: 91, improvement: 9 },
    { rank: 3, name: "Mike Johnson", role: "DevOps Engineer", score: 89, improvement: 7 },
    { rank: 4, name: "Sarah Williams", role: "Frontend Developer", score: 87, improvement: 5 },
    { rank: 5, name: "David Brown", role: "Cloud Architect", score: 85, improvement: 4 },
  ]

  // Recent activity data
  const recentActivities = [
    {
      type: "assessment",
      icon: CheckCircle2,
      iconColor: "text-green-600",
      bgColor: "bg-green-100",
      title: "John Doe completed Full Stack Developer Assessment",
      details: "Score: 91%",
      improvement: "+13 pts",
      time: "14 minutes ago",
    },
    {
      type: "improvement",
      icon: TrendingUp,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100",
      title: "Jane Smith improved capability score",
      details: "React: 85% → 92%",
      improvement: "+7%",
      time: "27 minutes ago",
    },
    {
      type: "learning",
      icon: BookOpen,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-100",
      title: "Mike Johnson started learning path",
      details: "Course: Redux Advanced Patterns",
      time: "1 hour ago",
    },
  ]

  // Skill gaps data
  const skillGaps = [
    { skill: "System Design", score: 65, employees: 18, color: "red" },
    { skill: "Cloud (AWS)", score: 58, employees: 22, color: "amber" },
    { skill: "DevOps Practices", score: 52, employees: 15, color: "orange" },
  ]

  const getTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good Morning"
    if (hour < 17) return "Good Afternoon"
    return "Good Evening"
  }

  return (
    <>
      {/* Top Greeting Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-mint-50 to-green-50 rounded-3xl p-8 mb-8 shadow-sm"
      >
        <h1 className="text-4xl font-black text-gray-900 mb-4">
          {getTimeOfDay()}, {adminName} 👋
        </h1>

        {/* Organization Info */}
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-full border-2 border-mint-200">
            <Building2 className="w-4 h-4 text-mint-600" />
            <span className="text-sm font-semibold text-gray-700">
              <span className="font-bold text-mint-600">{orgName}</span>
              {orgId && orgId !== orgName && (
                <span className="text-gray-500 ml-2">({orgId})</span>
              )}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Row 1 - 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Total Employees */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-mint-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-mint-600" />
            </div>
            <MoreVertical className="w-5 h-5 text-gray-400 cursor-pointer" />
          </div>

          <h3 className="text-4xl font-black text-gray-900 mb-2">{totalEmployees}</h3>
          <p className="text-sm text-gray-600 mb-3">Total Employees</p>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-mint-50 rounded-full">
              <TrendingUp className="w-3 h-3 text-mint-600" />
              <span className="text-xs font-bold text-mint-600">+3 new</span>
            </div>
            <span className="text-xs text-gray-500">vs last month</span>
          </div>
        </motion.div>

        {/* Card 2: Average Capability Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <MoreVertical className="w-5 h-5 text-gray-400 cursor-pointer" />
          </div>

          <h3 className="text-4xl font-black text-gray-900 mb-2">74.5%</h3>
          <p className="text-sm text-gray-600 mb-3">Average Capability</p>

          {/* Mini circular progress */}
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle cx="24" cy="24" r="20" stroke="#E5E7EB" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#10B981"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${74.5 * 1.256} 125.6`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">
                74.5%
              </span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs font-bold text-green-600">+2.3%</span>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Learning Hours */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <MoreVertical className="w-5 h-5 text-gray-400 cursor-pointer" />
          </div>

          <h3 className="text-4xl font-black text-gray-900 mb-2">1,256</h3>
          <p className="text-sm text-gray-600 mb-3">Learning Hours</p>

          {/* Mini trend line chart */}
          <div className="flex items-end gap-1 h-8">
            {[40, 45, 42, 50, 48, 55, 52, 60, 58, 65, 62, 68].map((height, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-200 rounded-t"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full mt-2 w-fit">
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span className="text-xs font-bold text-blue-600">+8% this month</span>
          </div>
        </motion.div>

        {/* Card 4: Skills Improved */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <MoreVertical className="w-5 h-5 text-gray-400 cursor-pointer" />
          </div>

          <h3 className="text-4xl font-black text-gray-900 mb-2">342</h3>
          <p className="text-sm text-gray-600 mb-3">Skills Improved</p>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-full">
              <TrendingUp className="w-3 h-3 text-purple-600" />
              <span className="text-xs font-bold text-purple-600">+12% growth</span>
            </div>
          </div>

          <button className="mt-3 text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1">
            View Details <ChevronRight className="w-3 h-3" />
          </button>
        </motion.div>
      </div>

      {/* Row 2 - Top Performers + Skill Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Performers */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Top Performers
            </h2>
            <button className="text-sm font-semibold text-mint-600 hover:text-mint-700 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {topPerformers.map((performer, index) => (
              <motion.div
                key={performer.rank}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-mint-50 transition-colors"
              >
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg ${
                      performer.rank === 1
                        ? "bg-gradient-to-br from-amber-400 to-amber-600"
                        : performer.rank === 2
                        ? "bg-gradient-to-br from-gray-300 to-gray-400"
                        : performer.rank === 3
                        ? "bg-gradient-to-br from-orange-300 to-orange-400"
                        : "bg-gradient-to-br from-gray-200 to-gray-300"
                    }`}
                  >
                    {performer.rank}
                  </div>
                  {performer.rank === 1 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                      <Crown className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{performer.name}</h3>
                  <p className="text-xs text-gray-600">{performer.role}</p>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-black text-mint-600">{performer.score}</div>
                    <div className="text-xs text-gray-500">/100</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{performer.improvement} pts</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Skill Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm"
        >
          <h2 className="text-xl font-black text-gray-900 mb-6">Employees by Skill Level</h2>

          <div className="flex items-center justify-center mb-6">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={skillDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {skillDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-black text-gray-900">{totalEmployees}</div>
                <div className="text-xs text-gray-600">Employees</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-sm font-semibold text-gray-900">Expert</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">11</span>
                <span className="text-xs text-gray-600">(23%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-sm font-semibold text-gray-900">Advanced</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">21</span>
                <span className="text-xs text-gray-600">(45%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-amber-500 rounded-full" />
                <span className="text-sm font-semibold text-gray-900">Intermediate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">12</span>
                <span className="text-xs text-gray-600">(25%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-sm font-semibold text-gray-900">Beginner</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">3</span>
                <span className="text-xs text-gray-600">(7%)</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Row 3 - Recent Activity + Skill Gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-mint-600" />
              Recent Activity
            </h2>
            <button className="text-sm font-semibold text-mint-600 hover:text-mint-700 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {recentActivities.map((activity, index) => {
              const Icon = activity.icon
              return (
                <div key={index} className="flex gap-4">
                  <div className={`w-10 h-10 ${activity.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${activity.iconColor}`} />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-gray-900 mb-1">{activity.title}</p>
                    <div className="flex items-center gap-2 mb-2">
                      {activity.type === "assessment" && (
                        <span className="px-2 py-0.5 bg-mint-100 text-mint-700 text-xs font-semibold rounded-full">
                          Assessment
                        </span>
                      )}
                      <span className="text-xs text-gray-600">{activity.details}</span>
                      {activity.improvement && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <TrendingUp className="w-3 h-3" />
                          <span>{activity.improvement}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Top Skill Gaps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Top Skill Gaps
            </h2>
            <button className="text-sm font-semibold text-mint-600 hover:text-mint-700 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {skillGaps.map((gap, index) => {
              const colorConfig = {
                red: {
                  bg: "bg-red-50",
                  border: "border-red-200",
                  text: "text-red-600",
                  progressBg: "bg-red-200",
                  progressFill: "bg-red-600",
                },
                amber: {
                  bg: "bg-amber-50",
                  border: "border-amber-200",
                  text: "text-amber-600",
                  progressBg: "bg-amber-200",
                  progressFill: "bg-amber-600",
                },
                orange: {
                  bg: "bg-orange-50",
                  border: "border-orange-200",
                  text: "text-orange-600",
                  progressBg: "bg-orange-200",
                  progressFill: "bg-orange-600",
                },
              }
              const colors = colorConfig[gap.color as keyof typeof colorConfig]

              return (
                <div key={index} className={`p-4 ${colors.bg} border-2 ${colors.border} rounded-xl`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900">{gap.skill}</h3>
                    <span className={`text-2xl font-black ${colors.text}`}>{gap.score}%</span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700">{gap.employees} employees need improvement</span>
                  </div>

                  <div className={`h-2 ${colors.progressBg} rounded-full overflow-hidden`}>
                    <div className={`h-full ${colors.progressFill} rounded-full`} style={{ width: `${gap.score}%` }} />
                  </div>

                  {gap.color === "red" && (
                    <button className="mt-3 text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1">
                      Create Training Program <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* Row 4 - Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Find Talent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-br from-mint-400 to-green-500 rounded-2xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push("/dashboard/candidates")}
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">Find Talent</h3>
          <p className="text-sm text-white/80 mb-4">Search employees by capability scores and skills</p>

          <div className="flex items-center gap-2 text-white font-semibold">
            <span>Search Now</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* Create Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push("/competency")}
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">Create Assessment</h3>
          <p className="text-sm text-white/80 mb-4">Design new skill assessments for your team</p>

          <div className="flex items-center gap-2 text-white font-semibold">
            <span>Create Now</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* Add Employee */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push("/employee/management")}
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
            <UserPlus className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">Add Employee</h3>
          <p className="text-sm text-white/80 mb-4">Invite new team members to the platform</p>

          <div className="flex items-center gap-2 text-white font-semibold">
            <span>Add Now</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* View Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push("/dashboard/analytics")}
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">View Analytics</h3>
          <p className="text-sm text-white/80 mb-4">Deep dive into capability trends and insights</p>

          <div className="flex items-center gap-2 text-white font-semibold">
            <span>View Now</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>
      </div>
    </>
  )
}

