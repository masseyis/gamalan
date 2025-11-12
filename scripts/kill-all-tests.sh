#!/bin/bash
# kill-all-tests.sh - Emergency kill switch for all test processes
#
# Usage:
#   ./kill-all-tests.sh
#
# This is a convenience wrapper around cleanup-test-processes.sh
# that kills ALL test processes immediately without confirmation.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🛑 Emergency kill: Stopping ALL test processes..."
echo ""

"$SCRIPT_DIR/cleanup-test-processes.sh" --force

echo ""
echo "✅ Done! All test processes have been terminated."
echo ""
echo "💡 Tip: To prevent this in the future:"
echo "   - The agents now clean up processes automatically"
echo "   - Use Ctrl+C to stop agents gracefully"
echo "   - A periodic cleanup runs every 5 minutes"
