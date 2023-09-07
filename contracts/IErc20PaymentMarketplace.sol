// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "./IMarketplace.sol";

interface IErc20PaymentMarketplace is IMarketplace {
    function makeOffer(
        address collection,
        uint256 tokenId,
        uint256 offerPrice,
        uint64 durationInDays
    ) external;
}
