#!/bin/bash

# WynnTracker Revival Deployment Script

set -e

echo "🚀 Starting WynnTracker Revival deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found. Please create one based on .env.example${NC}"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --only=production

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm test

# Run linting
echo -e "${YELLOW}🔍 Running linting...${NC}"
npm run lint

# Deploy Discord commands
echo -e "${YELLOW}📡 Deploying Discord commands...${NC}"
npm run deploy-commands

# Test API connectivity
echo -e "${YELLOW}🔗 Testing API connectivity...${NC}"
node scripts/test-apis.js

# Create necessary directories
echo -e "${YELLOW}📁 Creating directories...${NC}"
mkdir -p logs data/cache data/backups

# Set permissions
echo -e "${YELLOW}🔒 Setting permissions...${NC}"
chmod -R 755 logs data

# Start with PM2 (production)
if [ "$1" = "production" ]; then
    echo -e "${YELLOW}🏭 Starting with PM2 (production mode)...${NC}"
    npm run prod
    echo -e "${GREEN}✅ WynnTracker Revival deployed successfully with PM2!${NC}"
    echo -e "${GREEN}📊 Use 'npm run prod:logs' to view logs${NC}"
    echo -e "${GREEN}📈 Use 'npm run prod:monit' to monitor performance${NC}"
# Start with Docker (container)
elif [ "$1" = "docker" ]; then
    echo -e "${YELLOW}🐳 Starting with Docker...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✅ WynnTracker Revival deployed successfully with Docker!${NC}"
    echo -e "${GREEN}📊 Use 'docker-compose logs -f' to view logs${NC}"
# Start normally (development)
else
    echo -e "${YELLOW}🔧 Starting in development mode...${NC}"
    npm start
fi