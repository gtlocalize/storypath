#!/bin/bash
# StoryPath Deployment Script

echo "Deploying StoryPath..."

# Copy backend files to /opt/vodbase/storypath/
sudo mkdir -p /opt/vodbase/storypath
sudo cp -r server.js package*.json ai/ database/ utils/ /opt/vodbase/storypath/

# Install backend dependencies
cd /opt/vodbase/storypath
npm install

# Restart backend server
pkill -9 -f "node /opt/vodbase/storypath/server.js"
nohup node server.js > /dev/null 2>&1 &

echo "Backend deployed and restarted"
echo "Frontend files are already in place at /var/www/html/storypath/"
echo "Deployment complete!"
