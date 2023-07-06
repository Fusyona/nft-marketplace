// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

interface IMarketplace {
    function list(address collection, uint256 tokenId, uint256 price) external;

    function buy(address collection, uint256 tokenId) external payable;

    function makeOffer(
        address collection,
        uint256 tokenId,
        uint64 durationInDays
    ) external payable;

    function makeCounteroffer(
        address collection,
        uint256 tokenId,
        uint256 offerId,
        uint256 newPriceOffer,
        uint64 durationInDays
    ) external;

    function takeCounteroffer(uint256 id) external payable;

    function isListed(
        address collection,
        uint256 tokenId
    ) external view returns (bool);

    function getFusyonaFeeFor(uint256 price) external view returns (uint256);

    function changePriceOf(
        address collection,
        uint256 tokenId,
        uint256 newPrice
    ) external;

    function takeOffer(
        address collection,
        uint256 tokenId,
        uint256 indexOfOfferMapping
    ) external;

    function cancelOffer(
        address collection,
        uint256 tokenId,
        uint256 indexOfOfferMapping
    ) external;

    function setFeeRatio(
        int128 _percentageMultipliedBy2Up64AndTwoDecimals
    ) external;

    function withdraw() external;

    function setFloorRatioFromPercentage(uint8 percentage) external;
}
