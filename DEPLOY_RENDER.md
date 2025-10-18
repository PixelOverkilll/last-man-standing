Render deployment guide

1) Create a new Web Service on Render
   - Connect your GitHub repo: PixelOverkilll/last-man-standing
   - Select branch: main
   - Use the service created by `render.yaml` (Render will auto-detect)

2) Service settings
   - Environment: Node
   - Start Command: npm run ws-server
   - Build Command: npm install
   - Port: 3000 (set environment variable PORT=3000 on Render)

3) Auto deploy
   - Enable auto deploy from the `main` branch.

4) Notes
   - The service will serve static files and the Socket.IO server on the same process (this repo's `server/socket-server.js`).
   - After deployment, update `CONFIG.SOCKET.BASE_URL.production` to the Render service URL (e.g. https://lms-socket-server.onrender.com) in `config.js`, commit and push, and re-deploy the site (or update your GitHub Pages accordingly).

5) Optional: Use a custom domain with HTTPS for production clients.

