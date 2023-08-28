// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IMarketplace} from "./IMarketplace.sol";
import {ABDKMath64x64} from "./libraries/ABDKMath64x64.sol";
import {MathFees} from "./libraries/MathFees.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

abstract contract Marketplace is
    IMarketplace,
    ERC1155Holder,
    Ownable,
    ERC721Holder
{
    using ABDKMath64x64 for int128;
    using MathFees for int128;

    struct NFTForSale {
        bool listed;
        uint256 price;
        address seller;
        mapping(uint256 => Offer) offers;
        uint256 totalOffers;
    }

    int128 public feeRatio = MathFees._npercent(int128(2));
    int128 public floorRatio = MathFees._npercent(int128(20));

    uint256 internal constant ONE_COPY = 1;
    uint64 internal constant ONE_DAY_IN_SECONDS = uint64(24 * 60 * 60);
    uint256 internal constant NO_COUNTER_OFFER = 0;

    uint256 public fusyBenefitsAccumulated;

    mapping(address => mapping(uint256 => NFTForSale)) internal nftsListed;

    Counteroffer[] counteroffers;

    constructor() {}

    receive() external payable {}

    function cancelOffer(
        address collection,
        uint256 tokenId,
        uint256 indexOfOfferMapping
    ) external override {
        _cancelOfferRequirements(collection, tokenId, indexOfOfferMapping);
        Offer storage offer = nftsListed[collection][tokenId].offers[
            indexOfOfferMapping
        ];
        offer.isInitialized = false;
        uint256 moneyToRebase = offer.price;
        address buyer = offer.buyer;
        _transfer(buyer, moneyToRebase);
        emit CancelledOffer(
            collection,
            tokenId,
            indexOfOfferMapping,
            moneyToRebase,
            buyer
        );
    }

    function _cancelOfferRequirements(
        address collection,
        uint256 tokenId,
        uint256 indexOfOfferMapping
    ) private view {
        NFTForSale storage nft = nftsListed[collection][tokenId];
        require(
            nft.totalOffers > indexOfOfferMapping,
            "Marketplace: Offer not found"
        );
        Offer memory offer = nftsListed[collection][tokenId].offers[
            indexOfOfferMapping
        ];
        require(msg.sender == offer.buyer, "Marketplace: Wrong Buyer");
        require(
            offer.isInitialized,
            "Marketplace: Offer already was cancelled"
        );
    }

    function _transfer(address to, uint256 amount) internal virtual;

    function withdraw() external override onlyOwner {
        require(
            fusyBenefitsAccumulated > 0,
            "Marketplace: Nothing to withdraw."
        );
        uint256 amountToWithdraw = fusyBenefitsAccumulated;
        fusyBenefitsAccumulated = 0;
        _transfer(owner(), amountToWithdraw);
        emit RootWithdrawal(owner(), amountToWithdraw);
    }

    function setFeeRatioFromPercentage(
        uint8 percentage
    ) external override onlyOwner {
        require(
            percentage <= 100,
            "Marketplace: Percentage must be less or equal than 100"
        );
        int128 newFeeRatio = MathFees._npercent(int128(uint128(percentage)));
        require(
            feeRatio != newFeeRatio,
            "Marketplace: New percentage is the same as the current one"
        );
        feeRatio = newFeeRatio;
    }

    function takeOffer(
        address collection,
        uint256 tokenId,
        uint256 indexOfOfferMapping
    ) external override {
        NFTForSale storage nft = nftsListed[collection][tokenId];
        Offer storage offer = nft.offers[indexOfOfferMapping];
        _takeOfferRequirements(nft, offer, indexOfOfferMapping);
        address seller = nft.seller;
        address buyer = offer.buyer;
        uint256 price = offer.price;
        nft.listed = false;
        offer.isInitialized = false;
        _trade(buyer, seller, collection, tokenId, price);
    }

    function _takeOfferRequirements(
        NFTForSale storage nft,
        Offer memory offer,
        uint256 indexOfOfferMapping
    ) private view {
        address seller = nft.seller;
        bool listed = nft.listed;
        uint256 totalOffers = nft.totalOffers;
        uint64 expirationDate = offer.expirationDate;
        require(
            msg.sender == seller,
            "Marketplace: Sender should be the seller"
        );
        require(listed, "Marketplace: NFT not found");
        require(
            totalOffers > indexOfOfferMapping,
            "Marketplace: Offer doesn't exist"
        );
        require(offer.isInitialized, "Marketplace: Offer was used");
        require(
            expirationDate >= block.timestamp,
            "Marketplace: Offer expired"
        );
    }

    function _trade(
        address buyer,
        address seller,
        address collection,
        uint256 nftId,
        uint256 priceOfTrade
    ) private {
        _payingBenefits(seller, priceOfTrade);
        _safeTransferTo(buyer, collection, nftId);
        emit NFTSold(buyer, seller, collection, nftId, priceOfTrade);
    }

    function _payingBenefits(address seller, uint256 moneyRequired) private {
        uint256 fusyonaFee = getFusyonaFeeFor(moneyRequired);
        fusyBenefitsAccumulated += fusyonaFee;
        _transfer(seller, moneyRequired - fusyonaFee);
    }

    function getFusyonaFeeFor(
        uint256 netPayment
    ) public view returns (uint256) {
        return feeRatio.mulu(netPayment);
    }

    function _safeTransferTo(
        address to,
        address collection,
        uint nftId
    ) private {
        if (_is1155(collection))
            _safeTransfer_1155(collection, nftId, address(this), to);
        else _safeTransfer_721(collection, nftId, address(this), to);
    }

    function _makeOffer(
        address collection,
        uint256 nftId,
        uint256 offerPrice_,
        uint64 durationInDays
    ) internal {
        uint256 offerPrice = _ensureAndGetPaymentFor(offerPrice_);
        _makeOfferRequirements(collection, nftId, offerPrice);

        address buyer = msg.sender;
        Offer memory offer = Offer({
            isInitialized: true,
            buyer: buyer,
            price: offerPrice,
            expirationDate: uint64(block.timestamp) +
                durationInDays *
                ONE_DAY_IN_SECONDS,
            counterofferId: NO_COUNTER_OFFER
        });
        NFTForSale storage nft = nftsListed[collection][nftId];
        uint256 offerId = nft.totalOffers;
        nft.offers[offerId] = offer;
        nft.totalOffers += 1;
        emit OfferMade(buyer, collection, nftId, offerId);
    }

    function _ensureAndGetPaymentFor(
        uint256 amount
    ) internal virtual returns (uint256);

    function _makeOfferRequirements(
        address collection,
        uint256 nftId,
        uint256 priceOffer
    ) private view {
        require(
            priceOffer >= minPriceOffer(collection, nftId),
            "Marketplace: Price must be greater or equal than the minimum offer price for that NFT (call minPriceOffer())"
        );
        require(isListed(collection, nftId), "Marketplace: NFT not listed");
    }

    function minPriceOffer(
        address collection,
        uint256 nftId
    ) public view returns (uint256) {
        NFTForSale storage nft = nftsListed[collection][nftId];
        uint256 currentPrice = nft.price;
        return (currentPrice - floorRatio.mulu(currentPrice));
    }

    function buy(address collection, uint256 nftId) external payable override {
        NFTForSale storage nft = nftsListed[collection][nftId];
        address seller = nft.seller;
        uint256 moneyRequired = nft.price;
        uint256 moneyReceived = _ensureAndGetPaymentFor(moneyRequired);

        require(nft.listed, "Marketplace: NFT not listed");

        nft.listed = false;
        _transferRemainingToSender(moneyReceived, moneyRequired);
        _trade(msg.sender, seller, collection, nftId, moneyRequired);
    }

    function _transferRemainingToSender(
        uint256 moneyReceived,
        uint256 moneyRequired
    ) private {
        uint256 remaining = moneyReceived - moneyRequired;
        if (remaining > 0) {
            payable(msg.sender).transfer(remaining);
        }
    }

    function list(
        address collection,
        uint256 nftId,
        uint256 price
    ) external override {
        require(
            !isListed(collection, nftId),
            "Marketplace: NFT already listed"
        );
        bool isErc1155 = _is1155(collection);
        require(
            isErc1155
                ? _senderIsOwnerOf1155Nft(collection, nftId)
                : _senderIsOwnerOf721Nft(collection, nftId),
            "Marketplace: You don't own the NFT"
        );
        require(price > 0, "Marketplace: Price must be greater than 0");

        address seller = msg.sender;

        if (isErc1155) _safeTransferFromSender_1155(collection, nftId);
        else _safeTransferFromSender_721(collection, nftId);

        NFTForSale storage newNFTforListing = nftsListed[collection][nftId];
        newNFTforListing.listed = true;
        newNFTforListing.price = price;
        newNFTforListing.seller = seller;
        emit NFTListed(seller, collection, nftId, price);
    }

    function isListed(
        address collection,
        uint256 nftId
    ) public view returns (bool) {
        NFTForSale storage nftTarget = nftsListed[collection][nftId];
        return nftTarget.listed;
    }

    function _is1155(address _contract) private view returns (bool) {
        bytes4 _INTERFACE_ID_ERC1155 = 0xd9b67a26;
        return
            ERC165Checker.supportsERC165InterfaceUnchecked(
                _contract,
                _INTERFACE_ID_ERC1155
            );
    }

    function _senderIsOwnerOf1155Nft(
        address collection,
        uint256 nftId
    ) private view returns (bool) {
        IERC1155 ierc1155 = IERC1155(collection);
        return ierc1155.balanceOf(msg.sender, nftId) > 0;
    }

    function _senderIsOwnerOf721Nft(
        address collection,
        uint256 nftId
    ) private view returns (bool) {
        IERC721 ierc721 = IERC721(collection);
        return ierc721.ownerOf(nftId) == msg.sender;
    }

    function _safeTransferFromSender_1155(
        address collection,
        uint nftId
    ) private {
        _safeTransfer_1155(collection, nftId, msg.sender, address(this));
    }

    function _safeTransfer_1155(
        address collection,
        uint nftId,
        address from,
        address to
    ) private {
        IERC1155 ierc1155 = IERC1155(collection);
        ierc1155.safeTransferFrom(from, to, nftId, ONE_COPY, "");
    }

    function _safeTransferFromSender_721(
        address collection,
        uint nftId
    ) private {
        _safeTransfer_721(collection, nftId, msg.sender, address(this));
    }

    function _safeTransfer_721(
        address collection,
        uint nftId,
        address from,
        address to
    ) private {
        IERC721 ierc721 = IERC721(collection);
        ierc721.safeTransferFrom(from, to, nftId);
    }

    function makeCounteroffer(
        address collection,
        uint256 nftId,
        uint256 offerId,
        uint256 newPrice,
        uint64 durationInDays
    ) external override {
        NFTForSale storage nft = nftsListed[collection][nftId];
        Offer storage offer = nft.offers[offerId];
        _makeCounterofferRequirements(nft, offer, newPrice);

        uint256 counterofferId = _saveCounteroffer(
            collection,
            nftId,
            offerId,
            newPrice,
            durationInDays,
            offer
        );
        emit CounterofferMade(collection, nftId, offerId, counterofferId);
    }

    function _makeCounterofferRequirements(
        NFTForSale storage nft,
        Offer storage offer,
        uint256 newPriceOffer
    ) private view {
        require(nft.listed, "Marketplace: NFT not listed");
        require(offer.isInitialized, "Marketplace: Offer not found");
        require(
            newPriceOffer > offer.price,
            "Marketplace: Price must be greater than offer"
        );
        require(
            newPriceOffer < nft.price,
            "Marketplace: Price must be less than NFT price"
        );
        require(
            offer.expirationDate >= block.timestamp,
            "Marketplace: Offer expired"
        );
        require(
            msg.sender == nft.seller,
            "Marketplace: You aren't selling the NFT"
        );
        require(
            _hasNotCounteroffer(offer),
            "Marketplace: Counteroffer already exists"
        );
    }

    function _hasNotCounteroffer(
        Offer storage offer
    ) private view returns (bool) {
        return offer.counterofferId == NO_COUNTER_OFFER;
    }

    function _saveCounteroffer(
        address collection,
        uint256 nftId,
        uint256 offerId,
        uint256 newPrice,
        uint64 durationInDays,
        Offer storage offer
    ) private returns (uint256 counterofferId) {
        counteroffers.push(
            Counteroffer({
                collection: collection,
                nftId: nftId,
                offerId: offerId,
                price: newPrice,
                expirationDate: uint64(block.timestamp) +
                    durationInDays *
                    ONE_DAY_IN_SECONDS
            })
        );

        counterofferId = counteroffers.length;
        offer.counterofferId = counterofferId;
    }

    function getCounteroffer(
        address collection,
        uint256 nftId,
        uint256 offerId
    ) external view returns (Counteroffer memory) {
        Offer memory offer = getOffer(collection, nftId, offerId);
        return _getCounterOfferById(offer.counterofferId);
    }

    function _getCounterOfferById(
        uint256 id
    ) private view returns (Counteroffer memory) {
        return counteroffers[id - 1];
    }

    function getOffer(
        address collection,
        uint256 nftId,
        uint256 offerId
    ) public view returns (Offer memory) {
        return nftsListed[collection][nftId].offers[offerId];
    }

    function takeCounteroffer(uint256 id) external payable override {
        _takeCounterofferRequirements(id);

        Offer memory offer = _getOfferByCounterofferId(id);
        Counteroffer memory counteroffer = _getCounterOfferById(id);
        NFTForSale storage nft = nftsListed[counteroffer.collection][
            counteroffer.nftId
        ];

        uint256 minAmountToPay = counteroffer.price - offer.price;
        uint256 receivedPayment = _ensureAndGetPaymentFor(minAmountToPay);

        nft.listed = false;

        _transferRemainingToSender(receivedPayment, minAmountToPay);

        address seller = nft.seller;
        _payingBenefits(seller, counteroffer.price);
        _safeTransferTo(
            msg.sender,
            counteroffer.collection,
            counteroffer.nftId
        );

        emit NFTSold(
            msg.sender,
            seller,
            counteroffer.collection,
            counteroffer.nftId,
            counteroffer.price
        );
        emit CounterofferTaken(id, counteroffer.price, seller);
    }

    function _takeCounterofferRequirements(uint256 id) private view {
        require(id > 0, "Marketplace: Counteroffer not found");
        require(
            id <= counteroffers.length,
            "Marketplace: Counteroffer not found"
        );
        Offer memory offer = _getOfferByCounterofferId(id);
        require(
            offer.buyer == msg.sender,
            "Marketplace: You didn't make the offer"
        );
        Counteroffer memory counteroffer = _getCounterOfferById(id);
        require(
            counteroffer.expirationDate > block.timestamp,
            "Marketplace: Counteroffer expired"
        );
    }

    function _getOfferByCounterofferId(
        uint256 id
    ) private view returns (Offer memory) {
        Counteroffer memory counteroffer = _getCounterOfferById(id);
        address collection = counteroffer.collection;
        uint256 nftId = counteroffer.nftId;
        uint256 offerId = counteroffer.offerId;

        return getOffer(collection, nftId, offerId);
    }

    function changePriceOf(
        address collection,
        uint256 tokenId,
        uint256 newPrice
    ) external override {
        NFTForSale storage nft = nftsListed[collection][tokenId];
        _changePriceRequirements(nft, newPrice);

        nft.price = newPrice;

        emit NFTPriceChanged(collection, tokenId, newPrice);
    }

    function _changePriceRequirements(
        NFTForSale storage nft,
        uint256 newPrice
    ) private view {
        require(nft.listed, "Marketplace: NFT not listed");
        require(
            msg.sender == nft.seller,
            "Marketplace: You aren't selling the NFT"
        );
        require(
            newPrice != nft.price,
            "Marketplace: New price is the same as current price"
        );
    }

    function setFloorRatioFromPercentage(uint8 percentage) external onlyOwner {
        require(
            percentage <= 100,
            "Marketplace: Percentage must be less or equal than 100"
        );

        int128 newFloorRatio = MathFees._npercent(int128(uint128(percentage)));
        require(
            newFloorRatio != floorRatio,
            "Marketplace: New percentage is the same as the current one"
        );

        floorRatio = newFloorRatio;
    }

    function getNftInfo(
        address collection,
        uint256 tokenId
    ) external view returns (NftInfo memory) {
        NFTForSale storage nft = nftsListed[collection][tokenId];
        return
            NftInfo({
                listed: nft.listed,
                price: nft.price,
                seller: nft.seller,
                totalOffers: nft.totalOffers
            });
    }
}
