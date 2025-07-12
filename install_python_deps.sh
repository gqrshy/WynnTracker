#!/bin/bash

echo "🔮 Installing Python dependencies for ARIMA prediction..."

# Check if pip is available
if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
elif command -v pip &> /dev/null; then
    PIP_CMD="pip"
else
    echo "❌ pip not found. Installing pip..."
    # Try to install pip
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y python3-pip
        PIP_CMD="pip3"
    elif command -v yum &> /dev/null; then
        sudo yum install -y python3-pip
        PIP_CMD="pip3"
    else
        echo "❌ Could not install pip automatically. Please install manually:"
        echo "   Ubuntu/Debian: sudo apt-get install python3-pip"
        echo "   CentOS/RHEL: sudo yum install python3-pip"
        exit 1
    fi
fi

echo "📦 Installing required packages..."
$PIP_CMD install pandas statsmodels numpy

# Test the installation
echo "🧪 Testing ARIMA predictor..."
cd "$(dirname "$0")"
python3 python/arima_predictor.py --next

if [ $? -eq 0 ]; then
    echo "✅ ARIMA prediction system is ready!"
    echo ""
    echo "🎯 Your bot now has Wynnpool-level prediction accuracy!"
    echo ""
    echo "Usage:"
    echo "  /annihilation predict  - Get AI-powered prediction"
    echo "  /annihilation compare  - Compare multiple sources"
    echo "  /annihilation record   - Add training data"
else
    echo "⚠️ ARIMA predictor test failed. Check the error messages above."
    echo "The bot will still work with basic prediction methods."
fi