#!/bin/bash

echo ""
echo "============================================"
echo "  OnlineSCADA Edge Gateway"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check config
if [ ! -f "config.json" ]; then
    echo "ERROR: config.json not found!"
    echo "Download it from: OnlineSCADA Dashboard → Settings → Edge Gateways"
    exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Start
echo "Starting Edge Gateway..."
echo "Press Ctrl+C to stop"
echo ""
node src/index.js