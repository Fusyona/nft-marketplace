// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "./MsgValuePaymentMarketplace.sol";

contract MarketplaceWithoutCounterOffer is MsgValuePaymentMarketplace {

    function listBatch(
        address collection,
        uint256[] calldata nftIds,
        uint256[] calldata price
    ) public {
        uint256 nftNumber = nftIds.length ;
        for(uint256 i; i < nftNumber ; ++i ) {
            list(collection, nftIds[i], price[i]) ;
        }
    }

    function _makeCounterofferRequirements(
        NFTForSale storage nft,
        Offer storage offer,
        uint256 newPriceOffer
    ) internal view virtual override {
        _checkOwner() ;
        super._makeCounterofferRequirements(nft, offer, newPriceOffer);
    }

}
