import Link from 'next/link'
import { Code, CheckCircle, Clock, Shield } from 'lucide-react'

export default function DataEngineeringHomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                <Code className="h-8 w-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Data Engineering Assessment
              </h1>
            </div>
            <nav className="flex space-x-4">
              <Link href="/data-engineering/assessment" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Start Assessment
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-6">
            Test Your PySpark Skills
          </h2>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
            Complete data engineering challenges to demonstrate your PySpark expertise.
            Write code, run tests, and get instant validation.
          </p>
          <div className="mt-10">
            <Link href="/data-engineering/assessment" className="bg-indigo-600 text-white text-lg px-8 py-4 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2">
              <Code className="h-5 w-5" />
              Begin Assessment
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              icon: Code,
              title: 'Real PySpark Challenges',
              description: 'Work with actual PySpark code and DataFrames'
            },
            {
              icon: CheckCircle,
              title: 'Instant Validation',
              description: 'Get immediate feedback on your solutions'
            },
            {
              icon: Shield,
              title: 'Secure Execution',
              description: 'Code runs safely in isolated containers'
            }
          ].map((feature, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
              <div className="h-12 w-12 mx-auto mb-4 rounded-lg bg-indigo-100 p-2.5">
                <feature.icon className="h-full w-full text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Test Section */}
        <div className="mt-20 bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Quick Test</h3>
          <p className="text-gray-600 mb-6">
            Try a simple test to see the data engineering service in action.
          </p>
          <div className="space-y-4">
            <Link href="/data-engineering/simple-test" className="block w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors text-center">
              Run Simple Test
            </Link>
            <Link href="/data-engineering/practice" className="block w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors text-center">
              Practice Mode
            </Link>
            <Link href="/data-engineering/dashboard" className="block w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors text-center">
              View Dashboard
            </Link>
          </div>
        </div>

        {/* Assessment Info */}
        <div className="mt-20 bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Assessment Details</h3>
          <div className="space-y-4 text-gray-600">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Time Limit</p>
                <p className="text-sm">60 minutes to complete the challenge</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Code className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Code Editor</p>
                <p className="text-sm">Monaco editor with syntax highlighting and auto-completion</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Validation</p>
                <p className="text-sm">Automated testing against expected outputs with detailed feedback</p>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link href="/data-engineering/assessment" className="block w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors text-center">
              Start Assessment Now
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}