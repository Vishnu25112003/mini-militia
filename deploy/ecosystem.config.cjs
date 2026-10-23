// pm2 process file: restarts the game server on crash and (with `pm2 startup` + `pm2 save`) on reboot.
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'mini-militia-server',
      cwd: __dirname + '/..',
      script: 'npm',
      args: 'run start:server',
      env: {
        NODE_ENV: 'production',
        PORT: 2567,
        HOST: '127.0.0.1', // nginx is the only public entry point
      },
      max_restarts: 20,
      restart_delay: 2000,
      time: true,
    },
  ],
};
