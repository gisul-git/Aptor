#!/bin/bash

# Rollback Script for topic_service_v2.py Refactoring
# This script reverts the refactoring if tests fail or issues are discovered

set -e  # Exit on error

echo "🔄 Starting rollback of topic_service_v2.py refactoring..."
echo ""

# Check if we're in the right directory
if [ ! -f "backend/app/api/v1/assessments/topic_service_v2.py" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Check if backup exists
if [ ! -f "backend/app/api/v1/assessments/topic_service_v2.py.BACKUP" ]; then
    echo "⚠️  Warning: Backup file not found!"
    echo "   Attempting to restore from git..."
    
    # Try to restore from git
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo "   Restoring from git HEAD..."
        git checkout HEAD -- backend/app/api/v1/assessments/topic_service_v2.py
        echo "   ✅ Restored from git"
    else
        echo "   ❌ No git repository found and no backup available!"
        echo "   Cannot rollback automatically. Please restore manually."
        exit 1
    fi
else
    echo "📦 Restoring from backup file..."
    cp backend/app/api/v1/assessments/topic_service_v2.py.BACKUP \
       backend/app/api/v1/assessments/topic_service_v2.py
    echo "   ✅ Restored from backup"
fi

# Remove new directories if they exist
echo ""
echo "🗑️  Removing new refactored directories..."

if [ -d "backend/app/api/v1/assessments/services" ]; then
    rm -rf backend/app/api/v1/assessments/services/
    echo "   ✅ Removed services/ directory"
else
    echo "   ℹ️  services/ directory not found (already removed or not created)"
fi

if [ -d "backend/app/api/v1/assessments/models" ]; then
    rm -rf backend/app/api/v1/assessments/models/
    echo "   ✅ Removed models/ directory"
else
    echo "   ℹ️  models/ directory not found (already removed or not created)"
fi

# Verify restoration
echo ""
echo "✅ Rollback complete!"
echo ""
echo "📋 Verification:"
echo "   - Original file restored: $(test -f backend/app/api/v1/assessments/topic_service_v2.py && echo '✅' || echo '❌')"
echo "   - New directories removed: $(test ! -d backend/app/api/v1/assessments/services && echo '✅' || echo '❌')"
echo ""
echo "⚠️  Next steps:"
echo "   1. Run tests to verify everything works:"
echo "      pytest tests/test_refactoring_safety.py -v"
echo "   2. Investigate what went wrong before trying again"
echo "   3. Check git status for any uncommitted changes"
echo ""




