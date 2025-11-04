#!/bin/bash
# tail-agent-logs.sh - Monitor all agent logs in real-time

LOG_DIR="./logs/autonomous-agents"

# Check if log directory exists
if [ ! -d "$LOG_DIR" ]; then
  echo "Error: Log directory not found: $LOG_DIR"
  echo "Have you started the agents yet?"
  exit 1
fi

# Check if there are any log files
if [ -z "$(ls -A $LOG_DIR/*.log 2>/dev/null)" ]; then
  echo "Error: No log files found in $LOG_DIR"
  echo "Have you started the agents yet?"
  exit 1
fi

echo "Monitoring agent logs: $LOG_DIR/*.log"
echo "Press Ctrl+C to stop"
echo ""

# Tail all log files
tail -f "$LOG_DIR"/*.log
