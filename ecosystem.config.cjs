module.exports = {
  apps: [
    {
      name: "senda",
      cwd: "/home/ubuntu/apps/senda/current",
      script: "npm",
      args: "run start:prod",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: "3010",
      },
    },
  ],
};
