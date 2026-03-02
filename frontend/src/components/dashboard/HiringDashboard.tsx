import { motion } from "framer-motion"
import {
  Users,
  Target,
  Briefcase,
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  BarChart3,
  FileText,
  UserPlus,
  Search,
} from "lucide-react"
import { useRouter } from "next/router"

interface FunnelBarProps {
  label: string
  count: number
  percentage: number
  color: "blue" | "mint" | "green" | "purple" | "amber"
}

function FunnelBar({ label, count, percentage, color }: FunnelBarProps) {
  const colorClasses = {
    blue: "bg-blue-500",
    mint: "bg-mint-500",
    green: "bg-green-500",
    purple: "bg-purple-500",
    amber: "bg-amber-500",
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-32 text-sm font-semibold text-gray-700">{label}</div>
      <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
        <motion.div
          className={`h-full ${colorClasses[color]} rounded-lg flex items-center justify-end pr-2`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="text-xs font-bold text-white">{count}</span>
        </motion.div>
      </div>
      <div className="w-16 text-sm font-bold text-gray-900 text-right">{percentage}%</div>
    </div>
  )
}

interface PositionCardProps {
  title: string
  department: string
  applicants: number
  passed: number
  status: string
}

function PositionCard({ title, department, applicants, passed, status }: PositionCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-600 mb-3">{department}</p>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-black text-gray-900">{applicants}</div>
          <div className="text-xs text-gray-600">Applicants</div>
        </div>
        <div>
          <div className="text-lg font-black text-green-600">{passed}</div>
          <div className="text-xs text-gray-600">Passed</div>
        </div>
      </div>
    </div>
  )
}

interface CandidateRowProps {
  name: string
  score: number
  position: string
  status: string
}

function CandidateRow({ name, score, position, status }: CandidateRowProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
      <div className="flex-1">
        <h3 className="font-bold text-gray-900">{name}</h3>
        <p className="text-xs text-gray-600">{position}</p>
      </div>
      <div className="text-right">
        <div className="text-lg font-black text-blue-600">{score}%</div>
        <div className="text-xs text-gray-600">{status}</div>
      </div>
    </div>
  )
}

export function HiringDashboard() {
  const router = useRouter()

  return (
    <>
      {/* Top Greeting Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 mb-8 shadow-sm"
      >
        <h1 className="text-4xl font-black text-gray-900 mb-4">Hiring Dashboard 🎯</h1>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Active Positions */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-full border-2 border-blue-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-gray-700">15 Active Positions</span>
          </div>

          {/* Offers Extended */}
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border-2 border-green-200">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-700">8 Offers Extended</span>
          </div>

          {/* Pending Reviews */}
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full border-2 border-amber-200">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">23 Pending Reviews</span>
          </div>
        </div>
      </motion.div>

      {/* Row 1 - 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Candidates Screened */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <h3 className="text-4xl font-black text-gray-900 mb-2">247</h3>
          <p className="text-sm text-gray-600 mb-1">Candidates Screened</p>
          <p className="text-xs text-gray-500 mb-3">This month</p>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full">
              <TrendingUp className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-bold text-blue-600">+34 new</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Pass Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <h3 className="text-4xl font-black text-gray-900 mb-2">68%</h3>
          <p className="text-sm text-gray-600 mb-1">Pass Rate</p>
          <p className="text-xs text-gray-500 mb-3">Above industry avg</p>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs font-bold text-green-600">+5.2%</span>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Open Positions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-purple-600" />
            </div>
          </div>

          <h3 className="text-4xl font-black text-gray-900 mb-2">12</h3>
          <p className="text-sm text-gray-600 mb-1">Open Positions</p>
          <p className="text-xs text-gray-500 mb-3">Across 4 departments</p>
        </motion.div>

        {/* Card 4: Avg Time to Hire */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>

          <h3 className="text-4xl font-black text-gray-900 mb-2">5.2</h3>
          <p className="text-sm text-gray-600 mb-1">Avg Time to Hire</p>
          <p className="text-xs text-gray-500 mb-3">From application</p>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full">
              <TrendingUp className="w-3 h-3 text-green-600 rotate-180" />
              <span className="text-xs font-bold text-green-600">-1.3 days</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Hiring Funnel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl p-6 mb-8 border-2 border-gray-200 shadow-sm"
      >
        <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          Hiring Funnel
        </h2>

        <div className="space-y-3">
          <FunnelBar label="Applications" count={247} percentage={100} color="blue" />
          <FunnelBar label="Invited to Assess" count={180} percentage={73} color="blue" />
          <FunnelBar label="Started Assessment" count={156} percentage={63} color="mint" />
          <FunnelBar label="Completed" count={124} percentage={50} color="green" />
          <FunnelBar label="Passed" count={89} percentage={36} color="green" />
          <FunnelBar label="Interviews Scheduled" count={45} percentage={18} color="purple" />
          <FunnelBar label="Offers Extended" count={12} percentage={5} color="amber" />
          <FunnelBar label="Hired" count={8} percentage={3} color="green" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-xs text-gray-600 mb-1">Conversion Rate</div>
            <div className="text-2xl font-black text-gray-900">3.2%</div>
            <div className="text-xs text-gray-500 mt-1">Application to Hire</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <div className="text-xs text-gray-600 mb-1">Avg Score</div>
            <div className="text-2xl font-black text-gray-900">72.4%</div>
            <div className="text-xs text-gray-500 mt-1">Of passed candidates</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="text-xs text-gray-600 mb-1">Time to Fill</div>
            <div className="text-2xl font-black text-gray-900">18 days</div>
            <div className="text-xs text-gray-500 mt-1">Average per position</div>
          </div>
        </div>
      </motion.div>

      {/* Open Positions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-2xl p-6 mb-8 border-2 border-gray-200 shadow-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-900">Open Positions</h2>
          <button className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PositionCard
            title="Senior Full Stack Developer"
            department="Engineering"
            applicants={45}
            passed={12}
            status="active"
          />
          <PositionCard
            title="DevOps Engineer"
            department="Infrastructure"
            applicants={38}
            passed={9}
            status="active"
          />
          <PositionCard
            title="Product Manager"
            department="Product"
            applicants={67}
            passed={18}
            status="active"
          />
        </div>
      </motion.div>

      {/* Top Candidates + Hiring Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Candidates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-gray-900">Top Candidates This Week</h2>
            <button className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <CandidateRow name="Alice Williams" score={95} position="Full Stack Dev" status="Interview Scheduled" />
            <CandidateRow name="Bob Johnson" score={92} position="DevOps Engineer" status="Pending Review" />
            <CandidateRow name="Charlie Brown" score={89} position="Full Stack Dev" status="Passed" />
            <CandidateRow name="Diana Prince" score={87} position="Product Manager" status="Passed" />
            <CandidateRow name="Eve Smith" score={85} position="Full Stack Dev" status="Interview Scheduled" />
          </div>
        </motion.div>

        {/* Hiring Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm"
        >
          <h2 className="text-xl font-black text-gray-900 mb-6">Hiring Analytics</h2>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="text-sm font-semibold text-gray-700 mb-2">Applications Over Time</div>
              <div className="h-32 bg-white rounded-lg flex items-end justify-between gap-1 p-2">
                {[60, 75, 65, 80, 70, 85, 90, 78, 82, 88, 75, 90].map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-blue-500 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-xl">
              <div className="text-sm font-semibold text-gray-700 mb-2">Pass Rate by Position</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Full Stack Dev</span>
                  <span className="text-sm font-bold text-gray-900">72%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">DevOps Engineer</span>
                  <span className="text-sm font-bold text-gray-900">68%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Product Manager</span>
                  <span className="text-sm font-bold text-gray-900">65%</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Post New Job */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push("/dashboard/positions/create")}
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
            <Briefcase className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">Post New Job</h3>
          <p className="text-sm text-white/80 mb-4">Create a new job posting and start receiving applications</p>

          <div className="flex items-center gap-2 text-white font-semibold">
            <span>Post Now</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* Review Candidates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-br from-mint-400 to-green-500 rounded-2xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push("/dashboard/candidates")}
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">Review Candidates</h3>
          <p className="text-sm text-white/80 mb-4">Review and evaluate candidate assessments</p>

          <div className="flex items-center gap-2 text-white font-semibold">
            <span>Review Now</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* Create Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push("/competency")}
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">Create Assessment</h3>
          <p className="text-sm text-white/80 mb-4">Design assessments for candidate screening</p>

          <div className="flex items-center gap-2 text-white font-semibold">
            <span>Create Now</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* Hiring Reports */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push("/dashboard/reports/hiring")}
        >
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">Hiring Reports</h3>
          <p className="text-sm text-white/80 mb-4">View detailed hiring analytics and insights</p>

          <div className="flex items-center gap-2 text-white font-semibold">
            <span>View Now</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>
      </div>
    </>
  )
}

