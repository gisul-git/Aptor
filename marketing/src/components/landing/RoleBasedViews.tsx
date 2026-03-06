'use client';

import React from 'react';

export default function RoleBasedViews() {
  return (
    <section className="py-20 md:py-32 px-4 md:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-[#2D5F4A] mb-4">
            Built for Every Stakeholder
          </h2>
          <p className="text-lg md:text-xl text-[#5A8B70] max-w-3xl mx-auto">
            Tailored experiences for Super Admins, Organization Admins, and Employees
          </p>
        </div>

        {/* Tab Buttons - static for now */}
        <div className="flex justify-center gap-4 mb-12 flex-wrap">
          <button className="px-6 py-3 bg-gradient-to-r from-[#2D7A52] to-[#2D5F4A] text-white rounded-full font-semibold shadow-lg">
            Super Admin
          </button>
          <button className="px-6 py-3 bg-[#E8F9F0] text-[#2D5F4A] rounded-full font-semibold">
            Organization Admin
          </button>
          <button className="px-6 py-3 bg-[#E8F9F0] text-[#2D5F4A] rounded-full font-semibold">
            Employee
          </button>
        </div>

        {/* Tab Content - Super Admin (static default) */}
        <div className="bg-gradient-to-br from-[#F8FDF9] to-white p-8 md:p-12 rounded-3xl border-2 border-[#C9F4D4] shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: Features */}
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-[#2D5F4A] mb-6">
                Super Admin Dashboard
              </h3>
              <ul className="space-y-4">
                {[
                  {
                    title: 'Multi-Organization Management',
                    description: 'Oversee all B2B clients from one dashboard',
                  },
                  {
                    title: 'Advanced Analytics',
                    description: 'Cross-organization capability insights',
                  },
                  {
                    title: 'Platform Configuration',
                    description: 'Customize competencies and features',
                  },
                  {
                    title: 'Billing & Subscriptions',
                    description: 'Manage all organization accounts',
                  },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[#9DE8B0] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm">✓</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#2D5F4A]">{item.title}</h4>
                      <p className="text-sm text-[#5A8B70]">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Mockup Placeholder */}
            <div className="bg-[#E8F9F0] rounded-2xl p-8 flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-[#5A8B70] font-medium">Super Admin Dashboard Mockup</p>
              </div>
            </div>
          </div>
        </div>

        {/* Note: Other tabs (Organization Admin, Employee) will be interactive later */}
      </div>
    </section>
  );
}


