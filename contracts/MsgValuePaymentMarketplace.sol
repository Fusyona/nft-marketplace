// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "./Marketplace.sol";
import "./IMsgValuePaymentMarketplace.sol";

contract MsgValuePaymentMarketplace is
    Marketplace,
    IMsgValuePaymentMarketplace
{
    function makeOffer(
        address collection,
        uint256 nftId,
        uint64 durationInDays
    ) external payable override {
        uint256 offerPrice = msg.value;
        _makeOffer(collection, nftId, offerPrice, durationInDays);
    }

    function _transfer(address to, uint256 amount) internal override {
        (bool success, ) = payable(to).call{value: amount}("");
        assert(success);
    }

    function _ensureAndGetPaymentFor(
        uint256 amount
    ) internal override returns (uint256) {
        if (msg.value < amount)
            revert IMsgValuePaymentMarketplace__InsufficientEthReceived(
                msg.value,
                amount
            );
        return msg.value;
    }
}
