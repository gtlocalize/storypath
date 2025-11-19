module.exports = {
  apps: [{
    name: 'storypath',
    script: 'server.js',
    cwd: '/opt/vodbase/storypath',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3004
    },
    error_file: '/opt/vodbase/storypath/logs/error.log',
    out_file: '/opt/vodbase/storypath/logs/out.log',
    log_file: '/opt/vodbase/storypath/logs/combined.log',
    time: true
  }]
};
