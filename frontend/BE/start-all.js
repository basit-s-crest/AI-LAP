const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

console.log("--- Starting Safecircle Services Launcher ---");

const srcWorkerPath = path.join(__dirname, '../FE/worker.mjs');
const destWorkerPath = path.join(__dirname, 'worker.mjs');

// 1. Copy worker.mjs to the current backend directory so it resolves its dependencies (like bullmq)
// from the backend's node_modules on Render.
try {
  if (fs.existsSync(srcWorkerPath)) {
    console.log("Found worker.mjs. Copying to backend directory...");
    fs.copyFileSync(srcWorkerPath, destWorkerPath);
    console.log("worker.mjs copied successfully.");
  } else {
    console.warn("WARNING: worker.mjs not found at " + srcWorkerPath);
  }
} catch (err) {
  console.error("Error copying worker.mjs:", err.message);
}

// 2. Start the Express backend server
console.log("Starting Express Backend (dist/server.js)...");
const serverProcess = fork(path.join(__dirname, 'dist/server.js'));

// 3. Start the BullMQ worker
let workerProcess = null;
if (fs.existsSync(destWorkerPath)) {
  console.log("Starting BullMQ Worker (worker.mjs)...");
  workerProcess = fork(destWorkerPath);
} else {
  console.error("CRITICAL: worker.mjs is missing from destination folder. Worker will not start.");
}

// 4. Handle exit events to ensure both processes live and die together
serverProcess.on('exit', (code) => {
  console.log(`Express Backend exited with code ${code}. Terminating worker...`);
  if (workerProcess) workerProcess.kill();
  process.exit(code || 0);
});

if (workerProcess) {
  workerProcess.on('exit', (code) => {
    console.log(`BullMQ Worker exited with code ${code}. Terminating backend...`);
    serverProcess.kill();
    process.exit(code || 0);
  });
}
