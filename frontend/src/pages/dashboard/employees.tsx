/**
 * Dashboard Employees Page
 * UI matches design: header, search/filter, 4 stat cards, employee profile cards grid.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { requireAuth } from '@/lib/auth';
import { FloatingTopBar } from '@/components/dashboard/FloatingTopBar';
import { FloatingTabs } from '@/components/dashboard/FloatingTabs';
import { useEmployees, type Employee } from '@/hooks/api/useEmployees';
import {
  TrendingUp,
  Users,
  Loader2,
  AlertCircle,
  UserCheck,
  Award,
  Sparkles,
  Search,
  Filter,
  LayoutGrid,
  Upload,
  Download,
  Mail,
  MapPin,
} from 'lucide-react';

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Placeholder capability/growth from name (deterministic, for UI only)
function getPlaceholderMetrics(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  const cap = 70 + (n % 25);
  const growth = 5 + (n % 15) + (n % 10) / 10;
  return { capability: cap, growth };
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number | string;
  label: string;
}) {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
      style={{ borderColor: '#E2E8F0' }}
    >
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-sm font-medium text-gray-500">{label}</div>
    </div>
  );
}

type EmployeeWithPhoto = Employee & { profilePhoto?: string; avatarUrl?: string };

function EmployeeProfileCard({ emp }: { emp: EmployeeWithPhoto }) {
  const metrics = getPlaceholderMetrics(emp.name);
  const initials = getInitials(emp.name);
  const isActive = emp.status === 'active';
  const photoUrl = emp.profilePhoto || emp.avatarUrl;

  return (
    <Link href={`/dashboard/employees/${emp.aaptorId}`}>
      <div className="group cursor-pointer overflow-hidden rounded-3xl border-2 border-gray-200 bg-white shadow-xl transition-all hover:border-mint-300 hover:shadow-2xl">
        {/* Gradient header */}
        <div className="relative h-24 bg-gradient-to-r from-mint-400 via-green-400 to-blue-400">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/20" />
        </div>

        <div className="relative -mt-12 px-6 pb-6">
          {/* Avatar + status dot: photo from DB or initials */}
          <div className="relative mb-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-mint-400 to-green-500 shadow-xl">
              {photoUrl ? (
                <img src={photoUrl} alt={emp.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-white drop-shadow-sm">{initials}</span>
              )}
            </div>
            {isActive && (
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-white bg-green-500" />
            )}
          </div>

          <div className="mb-4">
            <h3 className="mb-1 text-xl font-black text-gray-900 transition-colors group-hover:text-mint-600">
              {emp.name}
            </h3>
            <p className="mb-3 text-sm font-semibold text-gray-600">Senior Full Stack Developer</p>

            <div className="mb-4 space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 shrink-0 text-mint-600" />
                <span className="truncate">{emp.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 shrink-0 text-mint-600" />
                <span>Bengaluru, India</span>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-mint-100 px-2 py-1 text-xs font-semibold text-mint-700">
                {emp.status === 'active' ? 'Expert Level' : emp.status === 'pending' ? 'Growing' : 'Inactive'}
              </span>
              {emp.status === 'active' && (
                <span className="rounded-full bg-mint-100 px-2 py-1 text-xs font-semibold text-mint-700">
                  Top Performer
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t-2 border-gray-100 pt-4">
            <div>
              <div className="mb-1 text-xs font-semibold text-gray-600">Capability</div>
              <div className="text-2xl font-black text-gray-900">{metrics.capability}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-gray-600">Growth</div>
              <div className="text-2xl font-black text-green-600">+{metrics.growth.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

interface DashboardEmployeesPageProps {
  session: any;
}

export default function DashboardEmployeesPage({ session: _serverSession }: DashboardEmployeesPageProps) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 50;

  const { data, isLoading, error, refetch } = useEmployees({
    page,
    limit,
    search: searchQuery || undefined,
  });

  const employees: Employee[] = data?.employees ?? [];
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 0;

  const counts = useMemo(() => {
    let active = 0;
    employees.forEach((e) => {
      if (e.status === 'active') active++;
    });
    return { active };
  }, [employees]);

  // Placeholder averages for stats (could come from API later)
  const avgCapability = useMemo(() => {
    if (employees.length === 0) return 88;
    let sum = 0;
    employees.forEach((e) => {
      sum += getPlaceholderMetrics(e.name).capability;
    });
    return Math.round(sum / employees.length);
  }, [employees]);

  const avgGrowth = useMemo(() => {
    if (employees.length === 0) return 13.4;
    let sum = 0;
    employees.forEach((e) => {
      sum += getPlaceholderMetrics(e.name).growth;
    });
    return sum / employees.length;
  }, [employees]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-white" style={{ backgroundColor: '#FAFAFA' }}>
      <FloatingTopBar />
      <FloatingTabs />
      <main className="pt-24 pb-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Header: title + Import/Export */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Employees</h1>
              <p className="mt-1 text-sm text-gray-500">Manage your workforce and track capability development</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                style={{ borderColor: '#D1D5DB' }}
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                style={{ borderColor: '#D1D5DB' }}
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {/* Search + Filter bar */}
          <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                style={{ color: '#9CA3AF' }}
              />
              <input
                type="text"
                placeholder="Search employees by name, role, or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                style={{ borderColor: '#E5E7EB' }}
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              style={{ borderColor: '#E5E7EB' }}
            >
              <Filter className="h-4 w-4" />
              Filter
              <span className="text-gray-400">▾</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 transition hover:bg-gray-50"
              style={{ borderColor: '#E5E7EB' }}
              title="Grid view"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
          </form>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: '#0A5F38' }} />
              <span className="ml-3 text-gray-500">Loading employees...</span>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 shrink-0 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800">Failed to load employees</h3>
                  <p className="mt-1 text-sm text-red-700">{(error as Error)?.message ?? 'Unknown error'}</p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* 4 Stat cards */}
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={<Users className="h-6 w-6" style={{ color: '#047857' }} />}
                  iconBg="#D1FAE5"
                  value={total}
                  label="Total Employees"
                />
                <StatCard
                  icon={<UserCheck className="h-6 w-6" style={{ color: '#047857' }} />}
                  iconBg="#D1FAE5"
                  value={counts.active}
                  label="Active"
                />
                <StatCard
                  icon={<Award className="h-6 w-6" style={{ color: '#B45309' }} />}
                  iconBg="#FEF3C7"
                  value={avgCapability}
                  label="Avg Capability Score"
                />
                <StatCard
                  icon={<Sparkles className="h-6 w-6" style={{ color: '#7C3AED' }} />}
                  iconBg="#EDE9FE"
                  value={`${avgGrowth.toFixed(1)}%`}
                  label="Avg Growth Rate"
                />
              </div>

              {/* Employee cards grid */}
              {employees.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">No employees yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Employees will appear here when they are added to your organization.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {employees.map((emp) => (
                      <EmployeeProfileCard key={emp.aaptorId} emp={emp} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                      <p className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="rounded-lg border border-green-200 bg-white px-3 py-1.5 text-sm font-medium text-green-800 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-green-50"
                          style={{ borderColor: '#A7F3D0' }}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="rounded-lg border border-green-200 bg-white px-3 py-1.5 text-sm font-medium text-green-800 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-green-50"
                          style={{ borderColor: '#A7F3D0' }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
