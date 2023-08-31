// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "./IMarketplace.sol";

error IMsgValuePaymentMarketplace__InsufficientEthReceived(
    uint256 ethReceived,
    uint256 minValueToSend
);

interface IMsgValuePaymentMarketplace is IMarketplace {
    function makeOffer(
        address collection,
        uint256 tokenId,
        uint64 durationInDays
    ) external payable;
}
