#!/bin/bash

# Update from git
git pull

# Install dependencies
npm install

# Set production environment
export NODE_ENV=production

# Start/restart the system
npm run restart 