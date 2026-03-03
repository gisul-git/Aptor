import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, Home, Calendar } from 'lucide-react';

export default function Custom404() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50 via-white to-mint-100 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-mint-200 rounded-full blur-2xl opacity-50"></div>
            <AlertCircle className="w-24 h-24 text-primary relative" strokeWidth={1.5} />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-6xl md:text-7xl font-bold text-primary mb-4"
        >
          404
        </motion.h1>

        {/* Message */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl md:text-3xl font-semibold text-text-primary mb-4"
        >
          Page Not Found
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-lg text-text-secondary mb-8 max-w-md mx-auto"
        >
          The page you're looking for doesn't exist. To access the Aaptor platform, please request a demo first.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          {/* Schedule Demo Button */}
          <Link
            href="/schedule-demo"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-mint-100 hover:bg-mint-200 text-primary font-semibold text-lg transition-all duration-200 shadow-mint-soft hover:shadow-mint-soft-lg hover:-translate-y-0.5"
          >
            <Calendar className="w-5 h-5" />
            Schedule a Demo
          </Link>

          {/* Back to Home Button */}
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border-2 border-mint-200 hover:border-mint-300 text-primary font-semibold text-lg transition-all duration-200 hover:bg-mint-50"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12 p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-mint-200"
        >
          <p className="text-sm text-text-secondary">
            Looking for the Aaptor platform? Access to the dashboard and assessment tools requires an active account.{' '}
            <Link href="/schedule-demo" className="text-primary font-semibold hover:underline">
              Request a demo
            </Link>{' '}
            to get started.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
