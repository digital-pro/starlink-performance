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
    await run('npm run build');

    const projectName = process.env.VERCEL_PROJECT_NAME || 'levante-performance';
    const scope = process.env.VERCEL_SCOPE ? ` --scope ${process.env.VERCEL_SCOPE}` : '';
    const token = process.env.VERCEL_TOKEN ? ` --token ${process.env.VERCEL_TOKEN}` : '';
    await run(`npx -y vercel link --yes --project ${projectName}${scope}${token}`);

    const { stdout } = await run(`npx -y vercel --prod --yes${scope}${token}`);

    const match = stdout.match(/https?:\/\/[^\s]+\.vercel\.app/);
    const url = match ? match[0] : null;
    if (url) {
      console.log(`\nDeployed: ${url}\n`);
      const alias = process.env.VERCEL_ALIAS;
      if (alias) {
        try {
          await run(`npx -y vercel alias set ${url} ${alias}${token}`);
          console.log(`\nAliased to: https://${alias}\n`);
        } catch (e) {
          console.warn('\nAlias failed:', e?.message || e);
        }
      }
    } else {
      console.log('\nDeployed. (Could not parse deployment URL from output)\n');
    }
  } catch (err) {
    console.error('\nDeployment failed:', err?.message || err);
    process.exitCode = 1;
  }
})();
