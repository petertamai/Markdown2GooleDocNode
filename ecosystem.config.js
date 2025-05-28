module.exports = {
    apps: [{
      name: 'markdown-docs-api',
      script: 'server.js',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      merge_logs: true,
      time: true,
      
      // Monitoring and health checks
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Advanced PM2 features
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
      
      // Source map support
      source_map_support: true,
      
      // Instance settings
      instance_var: 'INSTANCE_ID',
      
      // Graceful shutdown
      kill_retry_time: 100,
      
      // Environment specific settings
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001
      },
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_timeout: 10000
    }],
  
    // Deployment configuration
    deploy: {
      production: {
        user: process.env.DEPLOY_USER || 'deploy',
        host: process.env.DEPLOY_HOST || 'your-server.com',
        ref: 'origin/main',
        repo: process.env.DEPLOY_REPO || 'git@github.com:yourusername/markdown-to-google-docs-api.git',
        path: process.env.DEPLOY_PATH || '/var/www/markdown-docs-api',
        'pre-deploy-local': '',
        'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
        'pre-setup': ''
      },
      staging: {
        user: process.env.DEPLOY_USER || 'deploy',
        host: process.env.DEPLOY_HOST || 'staging-server.com',
        ref: 'origin/develop',
        repo: process.env.DEPLOY_REPO || 'git@github.com:yourusername/markdown-to-google-docs-api.git',
        path: process.env.DEPLOY_PATH || '/var/www/markdown-docs-api-staging',
        'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging'
      }
    }
  };