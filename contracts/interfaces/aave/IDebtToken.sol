//SPDX-License-Identifier: Unlicense
pragma solidity >=0.6.0 <0.8.0;

// https://docs.aave.com/developers/v/2.0/the-core-protocol/debt-tokens
// Note: Only the interface methods related to this project's code are implemented here.
interface IDebtToken {
    function UNDERLYING_ASSET_ADDRESS() external view returns(address);
    function approveDelegation(address delegatee, uint256 amount) external;
    function borrowAllowance(address fromUser, address toUser) external view returns (uint256);
}
