const chalk = require('chalk');

const addresses = require('../src/addresses');

const asset = 'LINK';
const beneficiary = addresses.users.hardhat1;

async function main() {
  const tokenAddress = addresses.tokens[asset];

  console.log(
    chalk.cyan(`Checking ${asset} balance of ${beneficiary}...`)
  );

  let token = await ethers.getContractAt(
    'IERC20',
    tokenAddress,
  );

  const holderBalance = await token.balanceOf(beneficiary);
  console.log(
    chalk.gray(`  > balance: ${ethers.utils.formatEther(holderBalance)}`)
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
