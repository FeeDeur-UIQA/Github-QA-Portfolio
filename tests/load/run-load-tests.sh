#!/bin/bash

# Load Testing Quick Reference
# Run from project root: ./tests/load/run-load-tests.sh

echo "🚀 Load Testing Suite - Quick Run"
echo "=================================="
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed!"
    echo ""
    echo "Install k6:"
    echo "  macOS:   brew install k6"
    echo "  Windows: choco install k6"
    echo "  Linux:   See https://k6.io/docs/get-started/installation/"
    echo ""
    exit 1
fi

echo "✅ k6 found: $(k6 version)"
echo ""

# Build tests if needed
if [ ! -d "tests/load/compiled" ] || [ -z "$(ls -A tests/load/compiled)" ]; then
    echo "📦 Building load tests..."
    npm run load:build
    echo ""
fi

# Menu
echo "Select load test to run:"
echo "  1) Smoke Test (1 user, 10s) - Quick validation"
echo "  2) API Load Test (10-100 users, 5min) - Products API"
echo "  3) Search Load Test (20-100 users, 4min) - Search API"
echo "  4) E2E Journey Test (10-50 users, 7min) - Complete user flow"
echo "  5) Stress Test (100 users, 5min) - High load"
echo "  6) Spike Test (10→200→10, 3min) - Traffic surge"
echo "  7) All Tests (Sequential)"
echo ""
read -p "Enter choice (1-7): " choice

case $choice in
    1)
        echo "🔥 Running Smoke Test..."
        k6 run --vus 1 --duration 10s tests/load/compiled/products-load.test.js
        ;;
    2)
        echo "📊 Running API Load Test..."
        k6 run tests/load/compiled/products-load.test.js
        ;;
    3)
        echo "🔍 Running Search Load Test..."
        k6 run tests/load/compiled/search-load.test.js
        ;;
    4)
        echo "🛒 Running E2E Journey Test..."
        k6 run tests/load/compiled/user-journey.test.js
        ;;
    5)
        echo "💪 Running Stress Test..."
        k6 run --vus 100 --duration 5m tests/load/compiled/products-load.test.js
        ;;
    6)
        echo "⚡ Running Spike Test..."
        k6 run --stage 30s:10,10s:200,1m:200,10s:10,30s:10 tests/load/compiled/products-load.test.js
        ;;
    7)
        echo "🔄 Running All Tests..."
        echo ""
        echo "1/3: API Load Test"
        k6 run tests/load/compiled/products-load.test.js
        echo ""
        echo "2/3: Search Load Test"
        k6 run tests/load/compiled/search-load.test.js
        echo ""
        echo "3/3: E2E Journey Test"
        k6 run tests/load/compiled/user-journey.test.js
        echo ""
        echo "✅ All tests complete!"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "📄 Results saved to: tests/load/results/"
echo "✅ Load test complete!"
