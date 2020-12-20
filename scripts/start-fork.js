const execa = require('execa');

async function main() {
	const subprocess = execa('npx', ['hardhat', 'node', '--fork', process.env.MAINNET_PROVIDER]);

	subprocess.stdout.pipe(process.stdout);
	subprocess.stderr.pipe(process.stderr);

	await subprocess;
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

