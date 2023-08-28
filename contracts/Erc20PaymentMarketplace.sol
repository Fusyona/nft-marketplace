// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "./Marketplace.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IErc20PaymentMarketplace.sol";

contract Erc20PaymentMarketplace is Marketplace, IErc20PaymentMarketplace {
    using SafeERC20 for IERC20;

    IERC20 private immutable erc20;

    constructor(address erc20_) {
        erc20 = IERC20(erc20_);
    }

    function makeOffer(
        address collection,
        uint256 nftId,
        uint256 offerPrice,
        uint64 durationInDays
    ) external override {
        _makeOffer(collection, nftId, offerPrice, durationInDays);
    }

    function _transfer(address to, uint256 amount) internal override {
        erc20.safeTransfer(to, amount);
    }

    function _ensureAndGetPaymentFor(
        uint256 amount
    ) internal override returns (uint256) {
        erc20.safeTransferFrom(msg.sender, address(this), amount);
        return amount;
    }
}
