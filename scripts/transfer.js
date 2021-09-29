const chalk = require('chalk');

const addresses = require('../src/addresses');
const { impersonateAddress } = require('../src/utils/rpc');

const asset = 'DAI';
const amount = ethers.utils.parseEther('50000');
const beneficiary = addresses.users.hardhat1;

async function main() {
  console.log(chalk.cyan(
    `Transferring ${ethers.utils.formatEther(amount)} ${asset} from a large holder to ${beneficiary}...`)
  );

  const holder = await impersonateAddress(addresses.holders[asset]);

  let token = await ethers.getContractAt(
    'IERC20',
    addresses.tokens[asset]
  );

  const holderBalance = await token.balanceOf(holder.address);
  console.log(chalk.gray(`  > holder balance: ${ethers.utils.formatEther(holderBalance)}`));
  if (amount.gt(holderBalance)) {
    throw new Error(chalk.red('Holder does not have enough funds'));
  }

  let balance = await token.balanceOf(beneficiary);
  console.log(chalk.gray(
    `  > Beneficiary balance before: ${ethers.utils.formatEther(balance)}`
  ));

  token = token.connect(holder);

  console.log(chalk.cyan('  > Transferring...'));
  await token.transfer(beneficiary, amount);

  balance = await token.balanceOf(beneficiary);
  console.log(chalk.gray(
    `  > Beneficiary balance after: ${ethers.utils.formatEther(balance)}`
  ));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
