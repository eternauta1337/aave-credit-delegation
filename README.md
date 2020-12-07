## Aave Credit Delegation

This project is intended to be used as a tool for Aave v2 credit delegation, until [app.aave.com](https://app.aave.com) supports this feature in its UI.

It allows you to validate that a given collateral/loan pair can be used for credit delegation, provides instructions for performing the delegation via direct contract interaction, and provides some tools for simulating the delegation via forking.

#### Set up

1. Clone and install the repo

```
$ git clone clone git@github.com:ajsantander/aave-credit-delegation.git
$ cd aave-credit-delegation
$ npm install
```

1. Copy `.env.sample` to `.env` and specify your Infura private key, or Ethereum mainnet provider url. This will be used for forking mainnet and running simulations/checks against the fork.

#### Use credit delegation on Mainnet

1. Verify the validity of the credit delegation parameters as described in "Validating a pair" using unit tests
2. Use [app.aave.com](https://app.aave.com) to deposit the desired collateral as `lender`
3. Use Etherescan for `DataProvider.getReserveTokensAddresses(asset: <address of the token to delegate>)` to identify the associated debt token
4. From the previous point, use `stableDebtTokenAddress` or `variableDebtTokenAddress` depending on your desired interest rate model, then click on the address
5. Use `DebtToken.approveDelegation(delegatee: <credit delegation beneficiary>, amount: <amount of credit to approve>)`. If the associated DebtToken doesn't have verified sources, or doesn't have its proxy properly set up in Etherscan, build a UI with oneclickdapp, as in "Simulating credit delegation with a fork"
2. Use [app.aave.com](https://app.aave.com) to borrow as `borrower`

#### Resources

##### Oneclickdapp interfaces:
* LendingPool: https://oneclickdapp.com/monica-axiom/
* DataProvider: https://oneclickdapp.com/juice-empty/
* DAI: https://oneclickdapp.com/samba-mars/
* dsDAI: https://oneclickdapp.com/helena-austin/

##### Addresses:
* LendingPool: 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9
* DataProvider: 0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d
* dsDAI: 0x778A13D3eeb110A4f7bb6529F99c000119a08E92
* DAI: 0x6B175474E89094C44Da98b954EedeAC495271d0F

##### Etherscan links
* LendingPool: https://etherscan.io/address/0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9#readProxyContract
* DataProvider: https://etherscan.io/address/0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d#readContract
* dsDAI: https://etherscan.io/address/0x778A13D3eeb110A4f7bb6529F99c000119a08E92#readProxyContract
* DAI: https://etherscan.io/address/0x6B175474E89094C44Da98b954EedeAC495271d0F

##### Aave documentation:

https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool

#### Validating a pair

To validate a pair, use `test/CreditDelegation.test.js` to enter the desired collateral/loan pair, amounts, and interest model type, and then run the tests.

This will start a local fork of mainnet and simulate the credit delegation process with the specified parameters.

To run the simulation:

1. Edit `testPairs` in `test/CreditDelegation.test.js` with your desired parameters
2. Run `npm test`

If any test is skipped or fails, credit delegation may not be available for your desired parameters.

#### Simulating credit delegation with a fork

When using a fork of mainnet, Etherscan can be used to write to the fork, but not read, since it will always connect to mainnet while reading. Thus, the method described below uses [oneclickdapp.com](https://oneclickdapp.com) to provide a user interface for interacting with the contracts via a fork.

1. Start a fork of mainnet with `npm run start-fork`
2. Add a "Mainnet (fork)" network to Metamask, with url `http://0.0.0.0:8545` and network id `1`
3. Select and/or set up two test addresses in Metamask, `lender` and `borrower`
4. Use the `LendingPool` interface to call `getUserAccountData` for `lender`, verifying that its `totalCollateralETH` is zero
5. Use the `DAI` interface to approve Aave's `LendingPool` address, on behalf of `lender`
6. Use the `LendingPool` interface to call `deposit` with `lender`
7. Use `LendingPool.getUserAccountData` again to verifiy that `lender` deposited
8. Use `DataProvider.getReserveTokensAddresses` to get the address of the associated debt token, in this case `dsDAI`
9. Use `dsDAI.approveDelegation`
10. Finally, use `LendingPool.borrow` with `borrower`
