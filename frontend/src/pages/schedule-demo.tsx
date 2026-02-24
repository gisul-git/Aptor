'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import {
  BarChart,
  CalendarCheck,
  Check,
  CheckCircle,
  Clock,
  FileText,
  Gift,
  Info,
  Lock,
  Mail,
  Phone,
  Sparkles,
  Target,
} from 'lucide-react'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'

interface FormData {
  firstName: string
  lastName: string
  email: string
  company: string
  phone: string
  country: string
  jobTitle: string
  companySize: string
  competencies: string[]
  whatsapp: boolean
  privacyAgreed: boolean
  marketingConsent: boolean
}

export default function ScheduleDemoPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    phone: '',
    country: '',
    jobTitle: '',
    companySize: '',
    competencies: [],
    whatsapp: false,
    privacyAgreed: false,
    marketingConsent: false,
  })

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleCompetencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      competencies: checked
        ? [...prev.competencies, value]
        : prev.competencies.filter((c) => c !== value),
    }))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validate at least one competency is selected
    if (formData.competencies.length === 0) {
      alert('Please select at least one competency of interest')
      return
    }

    // Validate privacy agreement
    if (!formData.privacyAgreed) {
      alert('Please agree to the Privacy Policy and Terms of Service')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/schedule-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        // Success - redirect to thank you page
        router.push('/thank-you')
      } else {
        const error = await response.json()
        // Display specific validation errors if available
        if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
          const errorMessage = error.errors.join('\n')
          alert(`Validation errors:\n\n${errorMessage}`)
        } else {
          alert(error.message || 'Something went wrong. Please try again.')
        }
      }
    } catch (error) {
      console.error('Form submission error:', error)
      alert('Unable to submit form. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50/30 via-white to-mint-50/20">
      <Navbar />

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-mint-50 via-white to-mint-100 border-b-2 border-mint-200 pt-24">
        <div className="max-w-7xl mx-auto px-8 py-16 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-extrabold text-text-primary mb-4 tracking-tight"
          >
            Schedule Your Personalized Demo
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto"
          >
            See how Aaptor can transform your team's capability building in just 30 minutes
          </motion.p>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
          {/* Left Column - 2 of 5 columns (Benefits & Social Proof) */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-2xl shadow-xl border-2 border-mint-200 p-6 md:p-8 lg:sticky lg:top-8"
            >
              {/* A. Demo Benefits with Credits Banner */}
              <div className="mb-8">
                {/* Special Offer Banner */}
                <div className="bg-gradient-to-r from-mint-200 to-mint-100 rounded-xl p-5 border-2 border-mint-300 shadow-lg mb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <Gift className="w-6 h-6 text-mint-300" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-text-primary mb-2">
                        Get Free Platform Credits!
                      </h4>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        Schedule a demo and receive{' '}
                        <strong className="text-text-primary">free credits</strong> to create your
                        own assessments, generate questions for any competency, and test the platform
                        hands-on before committing.
                      </p>
                    </div>
                  </div>
                </div>

                {/* What You'll Get */}
                <h3 className="text-xl md:text-2xl font-bold text-text-primary mb-6 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 md:w-7 md:h-7 text-mint-300 flex-shrink-0" />
                  What You'll Get in Your Demo
                </h3>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-mint-300 mt-1 flex-shrink-0" />
                    <div>
                      <span className="text-sm md:text-base font-semibold text-text-primary block mb-1">
                        Live Platform Walkthrough
                      </span>
                      <span className="text-xs md:text-sm text-text-secondary">
                        See Aaptor's AI-powered assessments in action
                      </span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-mint-300 mt-1 flex-shrink-0" />
                    <div>
                      <span className="text-sm md:text-base font-semibold text-text-primary block mb-1">
                        Hands-On Trial Access
                      </span>
                      <span className="text-xs md:text-sm text-text-secondary">
                        Free credits to create questions, customize assessments, and take tests
                        yourself
                      </span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-mint-300 mt-1 flex-shrink-0" />
                    <div>
                      <span className="text-sm md:text-base font-semibold text-text-primary block mb-1">
                        Real-Time Analytics Dashboard
                      </span>
                      <span className="text-xs md:text-sm text-text-secondary">
                        Track capability scores and skill development progress
                      </span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-mint-300 mt-1 flex-shrink-0" />
                    <div>
                      <span className="text-sm md:text-base font-semibold text-text-primary block mb-1">
                        Custom Implementation Plan
                      </span>
                      <span className="text-xs md:text-sm text-text-secondary">
                        Tailored pricing and setup timeline for your organization
                      </span>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-mint-100 my-8"></div>

              {/* C. Try with Demo Credits */}
              <div className="mb-8">
                <div className="bg-mint-50 rounded-xl p-6 border-2 border-mint-200">
                  <h4 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-mint-300" />
                    Try These with Your Demo Credits
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-mint-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Create Custom Questions</p>
                        <p className="text-xs text-text-secondary">
                          Generate AI-powered questions for any competency
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <Target className="w-4 h-4 text-mint-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Build Your Assessment</p>
                        <p className="text-xs text-text-secondary">
                          Design and customize assessment flows
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-mint-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Take a Practice Test</p>
                        <p className="text-xs text-text-secondary">
                          Experience assessments from the candidate's perspective
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <BarChart className="w-4 h-4 text-mint-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">View Analytics</p>
                        <p className="text-xs text-text-secondary">
                          Explore capability scoring and reporting dashboards
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-mint-100 my-8"></div>

              {/* E. Contact Information */}
              <div className="border-t-2 border-mint-100 pt-6">
                <p className="text-xs md:text-sm font-semibold text-text-secondary mb-4">
                  Have questions before booking?
                </p>
                <div className="space-y-3">
                  <a
                    href="mailto:info@aaptor.com"
                    className="flex items-center gap-3 text-sm md:text-base text-text-primary hover:text-mint-300 transition-colors"
                  >
                    <Mail className="w-4 h-4 md:w-5 md:h-5 text-mint-300 flex-shrink-0" />
                    info@aaptor.com
                  </a>
                  <a
                    href="tel:+91 XXXXXXXXXX"
                    className="flex items-center gap-3 text-sm md:text-base text-text-primary hover:text-mint-300 transition-colors"
                  >
                    <Phone className="w-4 h-4 md:w-5 md:h-5 text-mint-300 flex-shrink-0" />
                    +91 XXXXXXXXXX
                  </a>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - 3 of 5 columns (Demo Form) */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-2xl shadow-xl border-2 border-mint-200 p-6 md:p-10"
            >
              {/* Form Header */}
              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
                  Request Your Demo
                </h2>
                <p className="text-sm md:text-base text-text-secondary">
                  Fill out the form below and we'll get back to you within 24 hours
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Full Name - Split into First + Last */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl text-text-primary font-medium focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl text-text-primary font-medium focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none"
                      placeholder="Smith"
                    />
                  </div>
                </div>

                {/* 2. Work Email */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl text-text-primary font-medium focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none"
                    placeholder="john@company.com"
                  />
                  <p className="text-xs text-text-subtle mt-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Please use your work email address
                  </p>
                </div>

                {/* 3. Company/Organization Name */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Company/Organization <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="company"
                    required
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl text-text-primary font-medium focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none"
                    placeholder="Acme Corporation"
                  />
                </div>

                {/* 4. Phone Number + 5. Country */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl text-text-primary font-medium focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none"
                      placeholder="+1 (555) 123-4567"
                    />
                    <label className="flex items-center mt-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
                      <input
                        type="checkbox"
                        name="whatsapp"
                        checked={formData.whatsapp}
                        onChange={handleInputChange}
                        className="mr-2 w-4 h-4 rounded border-2 border-gray-300 text-mint-300 focus:ring-mint-200"
                      />
                      Contact me on WhatsApp
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="country"
                      required
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl text-text-primary font-medium focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none cursor-pointer"
                    >
                      <option value="">Select country...</option>
                      <option value="US">United States</option>
                      <option value="UK">United Kingdom</option>
                      <option value="CA">Canada</option>
                      <option value="IN">India</option>
                      <option value="AU">Australia</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="SG">Singapore</option>
                      <option value="AE">United Arab Emirates</option>
                      <option value="BR">Brazil</option>
                      <option value="MX">Mexico</option>
                      <option value="JP">Japan</option>
                      <option value="KR">South Korea</option>
                      <option value="CN">China</option>
                    </select>
                  </div>
                </div>

                {/* 6. Job Title + 7. Company Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                      Job Title/Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="jobTitle"
                      required
                      value={formData.jobTitle}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl text-text-primary font-medium focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none cursor-pointer"
                    >
                      <option value="">Select your role...</option>
                      <option value="ceo">CEO/Founder</option>
                      <option value="vp">VP/Director</option>
                      <option value="hr">HR Manager</option>
                      <option value="ld">L&D Manager</option>
                      <option value="recruiter">Recruiter</option>
                      <option value="engineer">Engineering Manager</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                      Company Size <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="companySize"
                      required
                      value={formData.companySize}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl text-text-primary font-medium focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none cursor-pointer"
                    >
                      <option value="">Select size...</option>
                      <option value="1-50">1-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1,000 employees</option>
                      <option value="1001-5000">1,001-5,000 employees</option>
                      <option value="5000+">5,000+ employees</option>
                    </select>
                  </div>
                </div>

                {/* 8. Primary Competency Interest (Multi-select Checkboxes) */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-3">
                    Primary Competency Interest <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-text-secondary ml-2">
                      (Select all that apply)
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: 'general', label: 'General Assessment' },
                      { value: 'dsa', label: 'DSA Competency' },
                      { value: 'aiml', label: 'AI/ML' },
                      { value: 'cloud', label: 'Cloud Architecture' },
                      { value: 'devops', label: 'DevOps & CI/CD' },
                      { value: 'data', label: 'Data Engineering' },
                      { value: 'design', label: 'Design (UI/UX)' },
                      { value: 'custom', label: 'Custom Assessments' },
                    ].map((competency) => (
                      <label
                        key={competency.value}
                        className="flex items-center p-3 border-2 border-gray-300 rounded-lg hover:border-mint-300 hover:bg-mint-50/50 cursor-pointer transition-all group"
                      >
                        <input
                          type="checkbox"
                          name="competency"
                          value={competency.value}
                          checked={formData.competencies.includes(competency.value)}
                          onChange={handleCompetencyChange}
                          className="mr-3 w-5 h-5 rounded border-2 border-gray-300 text-mint-300 focus:ring-mint-200"
                        />
                        <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                          {competency.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 9. Privacy Policy Agreement */}
                <div className="border-t-2 border-mint-100 pt-6 space-y-3">
                  <label className="flex items-start cursor-pointer group">
                    <input
                      type="checkbox"
                      name="privacyAgreed"
                      required
                      checked={formData.privacyAgreed}
                      onChange={handleInputChange}
                      className="mt-1 mr-3 w-5 h-5 rounded border-2 border-gray-300 text-mint-300 focus:ring-mint-200"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      I agree to Aaptor's{' '}
                      <a
                        href="/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mint-300 font-semibold hover:underline"
                      >
                        Privacy Policy
                      </a>
                      {' '}and{' '}
                      <a
                        href="/terms-of-service"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mint-300 font-semibold hover:underline"
                      >
                        Terms of Service
                      </a>
                      {' '}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>

                  <label className="flex items-start cursor-pointer group">
                    <input
                      type="checkbox"
                      name="marketingConsent"
                      checked={formData.marketingConsent}
                      onChange={handleInputChange}
                      className="mt-1 mr-3 w-5 h-5 rounded border-2 border-gray-300 text-mint-300 focus:ring-mint-200"
                    />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      I'd like to receive product updates and resources from Aaptor (optional)
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-14 bg-gradient-to-r from-mint-200 to-mint-100 hover:from-mint-300 hover:to-mint-200 text-text-primary font-bold text-base md:text-lg rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-text-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CalendarCheck className="w-5 h-5 md:w-6 md:h-6" />
                      Schedule My Demo
                    </>
                  )}
                </button>

                {/* Trust Badges */}
                <div className="flex items-center justify-center flex-wrap gap-4 md:gap-6 text-xs md:text-sm text-text-secondary pt-6 border-t-2 border-mint-100">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 md:w-5 md:h-5 text-mint-300" />
                    <span className="font-medium">Secure & Private</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-mint-300" />
                    <span className="font-medium">No Credit Card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-mint-300" />
                    <span className="font-medium">30-Minute Demo</span>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

