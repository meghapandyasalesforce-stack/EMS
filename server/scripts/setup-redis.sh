#!/bin/bash

# Redis Setup Script for EMS-Paarsiv
# This script helps set up Redis for the application

echo "=========================================="
echo "Redis Setup for EMS-Paarsiv"
echo "=========================================="
echo ""

# Check if Redis is installed
if command -v redis-server &> /dev/null; then
    echo "✅ Redis is already installed"
    redis-server --version
else
    echo "❌ Redis is not installed"
    echo ""
    echo "Please install Redis:"
    echo ""
    echo "For macOS:"
    echo "  brew install redis"
    echo ""
    echo "For Ubuntu/Debian:"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install redis-server"
    echo ""
    echo "For Windows:"
    echo "  1. Download from: https://github.com/microsoftarchive/redis/releases"
    echo "  2. Or use WSL: wsl --install"
    echo "  3. Then install Redis in WSL"
    echo ""
    exit 1
fi

echo ""
echo "Starting Redis server..."
echo ""

# Check if Redis is already running
if redis-cli ping &> /dev/null; then
    echo "✅ Redis is already running"
else
    echo "Starting Redis server..."
    
    # Try to start Redis
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew services start redis
        echo "✅ Redis started via Homebrew"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo systemctl start redis-server
        echo "✅ Redis started via systemd"
    else
        # Other (Windows/WSL)
        echo "Please start Redis manually:"
        echo "  redis-server"
    fi
fi

echo ""
echo "Testing Redis connection..."
if redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis is working correctly!"
    echo ""
    echo "Redis Configuration:"
    echo "  Host: localhost"
    echo "  Port: 6379"
    echo "  URL: redis://localhost:6379"
    echo ""
    echo "✅ Setup complete! Redis is ready to use."
else
    echo "❌ Redis connection test failed"
    echo "Please check Redis installation and try again"
    exit 1
fi

