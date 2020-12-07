const { expect } = require('chai');
const { yellow } = require('chalk');

const addresses = require('../src/addresses');
const {
  impersonateAddress,
  takeSnapshot,
  restoreSnapshot,
} = require('../src/utils/rpc');

describe('Aave credit delegation', () => {
  let lendingPool, dataProvider, depositToken, debtToken, loanToken;

  let lender, borrower, someone;

	before('connect to signers', async () => {
    ([_, lender, borrower, someone] = await ethers.getSigners());
	});

	before('connect to aave contracts', async () => {
    lendingPool = await ethers.getContractAt('ILendingPool', addresses.aave.lendingPool);
    dataProvider = await ethers.getContractAt('IProtocolDataProvider', addresses.aave.dataProvider);
	});

	const itSuccesfullyDelegatesWith = ({
	  depositAsset,
	  loanAsset,
	  depositAmount,
	  delegatedAmount,
	  variable,
	}) => {
	  const depositAssetAddress = addresses.tokens[depositAsset];
	  const loanAssetAddress = addresses.tokens[loanAsset];
    const rateMode = variable ? 2 : 1;

    let snapshotId;

    before('take snapshot', async () => {
      snapshotId = await takeSnapshot();
    });

    after('restore snapshot', async () => {
      await restoreSnapshot(snapshotId);
    });

    describe(`when using ${ethers.utils.formatEther(depositAmount)} ${depositAsset} as collateral to loan ${ethers.utils.formatEther(delegatedAmount)} ${loanAsset} with ${variable ? 'variable' : 'stable'} interest`, () => {
      before('connect with tokens', async () => {
         depositToken = await ethers.getContractAt('IERC20', depositAssetAddress);
         loanToken = await ethers.getContractAt('IERC20', loanAssetAddress);
      });

      before(`validate that ${depositAsset} can be used as collateral and ${loanAsset} can be borrowed`, async function() {
        let assetData = await dataProvider.getReserveConfigurationData(depositToken.address);

        let canBeUsedAsCollateral = true;
        if (!assetData.usageAsCollateralEnabled) {
          console.log(yellow(`      > ${depositAsset} is not enabled for use as collateral`));
          canBeUsedAsCollateral = false;
        }
        if (!assetData.isActive) {
          console.log(yellow(`      > ${depositAsset} is not active`));
          canBeUsedAsCollateral = false;
        };
        if (assetData.isFrozen) {
          console.log(yellow(`      > ${depositAsset} is frozen`));
          canBeUsedAsCollateral = false;
        };

        assetData = await dataProvider.getReserveConfigurationData(loanToken.address);

        let canBeBorrowed = true;
        if (!assetData.borrowingEnabled) {
          console.log(yellow(`      > ${loanAsset} is not enabled for borrowing`));
          canBeBorrowed = false;
        };
        if (!variable && !assetData.stableBorrowRateEnabled) {
          console.log(yellow(`      > ${loanAsset} is not enabled for stable borrowing`));
          canBeBorrowed = false;
        };
        if (!assetData.isActive) {
          console.log(yellow(`      > ${loanAsset} is not active`));
          canBeBorrowed = false;
        };
        if (assetData.isFrozen) {
          console.log(yellow(`      > ${loanAsset} is frozen`));
          canBeBorrowed = false;
        };

        assetData = await dataProvider.getReserveData(loanToken.address);
        if (assetData.availableLiquidity.lt(delegatedAmount)) {
          console.log(yellow(`      > liquidity for ${loanAsset} is only ${ethers.utils.formatEther(assetData.availableLiquidity)}`));
          canBeBorrowed = false;
        }

        if (!canBeUsedAsCollateral || !canBeBorrowed) {
          console.log(yellow(`      > the ${depositAsset} / ${loanAsset} pair is not available for credit delegation, skipping tests...`));

          this.skip();
        }
      });

      describe(`when the lender has ${ethers.utils.formatEther(depositAmount)} ${depositAsset}`, () => {
        before('transfer asset from a large holder to the lender', async () => {
          const holder = await impersonateAddress(addresses.holders[depositAsset]);
          const holderBalance = await depositToken.balanceOf(holder.address);
          if (holderBalance.lt(depositAmount)) {
            throw new Error(`Holder only has ${ethers.utils.formatEther(holderBalance)} ${depositAsset}`);
          }

          depositToken = depositToken.connect(holder);

          await depositToken.transfer(lender.address, await depositToken.balanceOf(holder.address));
        });

        it('shows that the lender has the necessary balance', async () => {
          expect(
            await depositToken.balanceOf(lender.address)
          ).to.be.gte(depositAmount);
        });

        before('the lender deposits collateral', async () => {
          it('shows that the lender has no collateral', async () => {
            const userData = await lendingPool.getUserAccountData(lender.address);

            expect(
              userData.totalCollateralETH
            ).to.be.equal(0);
          });
        });

        describe(`when the lender approves the pool to spend its ${depositAsset}`, () => {
          before('lender provides allowance', async () => {
            depositToken = depositToken.connect(lender);

            await depositToken.approve(lendingPool.address, ethers.utils.parseEther('1000000'));
          });

          it('reflects the allowance', async () => {
            expect(
              await depositToken.allowance(lender.address, lendingPool.address)
            ).to.be.gte(depositAmount);
          });

          describe(`when the lender deposits ${ethers.utils.formatEther(depositAmount)} ${depositAsset} as collateral`, () => {
            before('lender deposits collateral', async () => {
              lendingPool = lendingPool.connect(lender);

              await lendingPool.deposit(depositAssetAddress, depositAmount, lender.address, 0);
            });

            before('connect to debt token', async () => {
              const reserveData = await dataProvider.getReserveTokensAddresses(loanAssetAddress);

              const debtTokenAddress = variable ? reserveData.variableDebtTokenAddress : reserveData.stableDebtTokenAddress;
              debtToken = await ethers.getContractAt('IDebtToken', debtTokenAddress);
            });

            it('shows that the lender has collateral', async () => {
              const userData = await lendingPool.getUserAccountData(lender.address);

              expect(
                userData.totalCollateralETH
              ).to.be.gt(0);
            });

            describe('before the lender approves credit delegation', () => {
              it('shows that the borrower doesnt have any delegated allowance', async () => {
                expect(
                  await debtToken.borrowAllowance(lender.address, borrower.address)
                ).to.be.equal(0);
              });

              it('shows that the lender has no debt', async () => {
                const userData = await lendingPool.getUserAccountData(lender.address);

                expect(
                  userData.totalDebtETH
                ).to.be.lt(ethers.utils.parseEther('0.01'));
              });
            });

            describe(`when the lender approves ${ethers.utils.formatEther(delegatedAmount)} ${loanAsset} of credit to the borrower`, () => {
              before('lender delegates credit', async () => {
                debtToken = debtToken.connect(lender);

                await debtToken.approveDelegation(borrower.address, delegatedAmount);
              });

              it('shows that the borrower has borrowing allowance', async () => {
                expect(
                  await debtToken.borrowAllowance(lender.address, borrower.address)
                ).to.be.equal(delegatedAmount);
              });

              it('doesnt allow someone else to borrow this credit', async () => {
                lendingPool = lendingPool.connect(someone);

                expect(
                  lendingPool.borrow(loanAssetAddress, delegatedAmount, rateMode, 0, lender.address)
                ).to.be.reverted;
              });

              describe('before the borrower takes the loan', async () => {
                it(`shows that the borrower has zero ${loanAsset}`, async () => {
                  expect(
                    await loanToken.balanceOf(borrower.address)
                  ).to.be.equal(0);
                });
              });

              describe(`when the borrower borrows ${ethers.utils.formatEther(delegatedAmount)} ${loanAsset}`, () => {
                before('borrower takes loan', async () => {
                  lendingPool = lendingPool.connect(borrower);

                  await lendingPool.borrow(loanAssetAddress, delegatedAmount, rateMode, 0, lender.address);
                });

                it('shows that the lender has debt', async () => {
                  const userData = await lendingPool.getUserAccountData(lender.address);

                  expect(
                    userData.totalDebtETH
                  ).to.be.gt(0);
                });

                it('credited the value to the borrower', async () => {
                  expect(
                    await loanToken.balanceOf(borrower.address)
                  ).to.be.equal(delegatedAmount);
                });

                describe(`when the borrower approves the pool to spend its ${loanAsset}`, () => {
                  before('borrower provides allowance', async () => {
                    loanToken = depositToken.connect(borrower);

                    await loanToken.approve(lendingPool.address, ethers.utils.parseEther('1000000'));
                  });

                  it('reflects the allowance', async () => {
                    expect(
                      await loanToken.allowance(borrower.address, lendingPool.address)
                    ).to.be.gte(delegatedAmount);
                  });

                  describe('when the borrower repays 50% of the loan', () => {
                    let debtBefore;
                    let balanceBefore;

                    before('record the initial values', async () => {
                      const userData = await lendingPool.getUserAccountData(lender.address);
                      debtBefore = userData.totalDebtETH;

                      balanceBefore = await loanToken.balanceOf(borrower.address);
                    });

                    before('repay 50% of the loan', async () => {
                      lendingPool = lendingPool.connect(borrower);

                      await lendingPool.repay(
                        loanAssetAddress,
                        delegatedAmount.div(ethers.BigNumber.from('2')),
                        rateMode,
                        lender.address
                      );
                    });

                    it('reduces the lenders debt', async () => {
                      const userData = await lendingPool.getUserAccountData(lender.address);

                      expect(
                        userData.totalDebtETH
                      ).to.be.lt(debtBefore);
                    });

                    it('reduces the borrowers balance', async () => {
                      expect(
                        await loanToken.balanceOf(borrower.address)
                      ).to.be.lt(balanceBefore);
                    });

                    describe('when the borrower repays the entire loan', () => {
                      before('repay 50% of the loan', async () => {
                        lendingPool = lendingPool.connect(borrower);

                        await lendingPool.repay(
                          loanAssetAddress,
                          delegatedAmount.div(ethers.BigNumber.from('2')),
                          variable ? 2 : 1,
                          lender.address
                        );
                      });

                      it('removes the lenders debt', async () => {
                        const userData = await lendingPool.getUserAccountData(lender.address);

                        expect(
                          userData.totalDebtETH
                        ).to.be.lt(ethers.utils.parseEther('0.01'));
                      });

                      it('reduces the borrowers balance', async () => {
                        expect(
                          await loanToken.balanceOf(borrower.address)
                        ).to.be.eq(0);
                      });

                      describe('when the lender withdraws collateral', () => {
                        let balanceBefore;

                        before('record the lenders balance', async () => {
                          balanceBefore = await depositToken.balanceOf(lender.address);
                        });

                        before('lender withdraws all collateral', async () => {
                          lendingPool = lendingPool.connect(lender);

                          await lendingPool.withdraw(depositAssetAddress, depositAmount, lender.address);
                        });

                        it('credited the lenders balance', async () => {
                          expect(
                            await depositToken.balanceOf(lender.address)
                          ).to.be.eq(balanceBefore.add(depositAmount));
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  // DAI -> DAI
  itSuccesfullyDelegatesWith({
    depositAsset: 'DAI',
    loanAsset: 'DAI',
    depositAmount: ethers.utils.parseEther('50000'),
    delegatedAmount: ethers.utils.parseEther('35000'),
    variable: false,
  });
  itSuccesfullyDelegatesWith({
    depositAsset: 'DAI',
    loanAsset: 'DAI',
    depositAmount: ethers.utils.parseEther('50000'),
    delegatedAmount: ethers.utils.parseEther('35000'),
    variable: true,
  });

  // DAI -> sUSD
  itSuccesfullyDelegatesWith({
    depositAsset: 'DAI',
    loanAsset: 'sUSD',
    depositAmount: ethers.utils.parseEther('50000'),
    delegatedAmount: ethers.utils.parseEther('35000'),
    variable: false,
  });
  itSuccesfullyDelegatesWith({
    depositAsset: 'DAI',
    loanAsset: 'sUSD',
    depositAmount: ethers.utils.parseEther('60000'),
    delegatedAmount: ethers.utils.parseEther('35000'),
    variable: true,
  });

  // WETH -> sUSD
  itSuccesfullyDelegatesWith({
    depositAsset: 'WETH',
    loanAsset: 'sUSD',
    depositAmount: ethers.utils.parseEther('100'),
    delegatedAmount: ethers.utils.parseEther('35000'),
    variable: false,
  });
  itSuccesfullyDelegatesWith({
    depositAsset: 'WETH',
    loanAsset: 'sUSD',
    depositAmount: ethers.utils.parseEther('100'),
    delegatedAmount: ethers.utils.parseEther('35000'),
    variable: true,
  });

  // sUSD -> sUSD
  itSuccesfullyDelegatesWith({
    depositAsset: 'sUSD',
    loanAsset: 'sUSD',
    depositAmount: ethers.utils.parseEther('50000'),
    delegatedAmount: ethers.utils.parseEther('35000'),
    variable: false,
  });
  itSuccesfullyDelegatesWith({
    depositAsset: 'sUSD',
    loanAsset: 'sUSD',
    depositAmount: ethers.utils.parseEther('50000'),
    delegatedAmount: ethers.utils.parseEther('35000'),
    variable: true,
  });
});
