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

    /**
    function cancelOffer(address collectiom, uint256 tokenId) external;

    function setMinOfferPrice(uint256 value) external;
    
    function setFeeRatio(int128 value) external;
    
    function withdrawBenefits() external;

      
     * 
     */
}
