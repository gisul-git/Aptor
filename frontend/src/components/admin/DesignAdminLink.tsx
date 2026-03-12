/**
 * Quick Link to Design Admin Panel
 * Add this component to any page for easy admin access
 */

import Link from 'next/link';

export default function DesignAdminLink() {
  return (
    <Link
      href="/admin/design"
      className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-105 flex items-center gap-2 z-50"
    >
      <span className="text-xl">🎨</span>
      <span className="font-medium">Design Admin</span>
    </Link>
  );
}
