import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

async function run(cmd) {
  console.log(`$ ${cmd}`);
  const { stdout, stderr } = await exec(cmd, { env: process.env });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return { stdout, stderr };
}

(async () => {
  try {
    // 1) Build (Vercel can also build, but we keep this to ensure public/ is ready)
    await run('npm run build');

    // 2) Link to Vercel project (idempotent)
    const projectName = process.env.VERCEL_PROJECT_NAME || 'levante-performance';
    const scope = process.env.VERCEL_SCOPE ? ` --scope ${process.env.VERCEL_SCOPE}` : '';
    const token = process.env.VERCEL_TOKEN ? ` --token ${process.env.VERCEL_TOKEN}` : '';
    await run(`npx -y vercel link --yes --project ${projectName}${scope}${token}`);

    // 3) Deploy (let Vercel perform its own build with provided config)
    const { stdout } = await run(`npx -y vercel --prod --yes${scope}${token}`);

    const match = stdout.match(/https?:\/\/[^\s]+\.vercel\.app/);
    if (match) {
      console.log(`\nDeployed: ${match[0]}\n`);
    } else {
      console.log('\nDeployed. (Could not parse deployment URL from output)\n');
    }
  } catch (err) {
    console.error('\nDeployment failed:', err?.message || err);
    process.exitCode = 1;
  }
})();
