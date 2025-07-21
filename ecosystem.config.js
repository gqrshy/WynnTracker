module.exports = {
  apps: [
    {
      name: 'wynntracker-revival',
      script: './src/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      // Monitoring
      monitoring: false,
      // Advanced settings
      node_args: '--max-old-space-size=1024'
    }
  ]
};