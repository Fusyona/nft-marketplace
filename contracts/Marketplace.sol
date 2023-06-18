// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IMarketplace} from "./IMarketplace.sol";
import {ABDKMath64x64} from "./libraries/ABDKMath64x64.sol";
import {MathFees} from "./libraries/MathFees.sol";

contract Marketplace is IMarketplace, ERC1155Holder, Ownable {
    using ABDKMath64x64 for int128;
    using MathFees for int128;

    struct NFTForSale {
        bool listed;
        uint256 price;
        address seller;
        mapping(uint256 => Offer) offers;
        uint256 totalOffers;
    }

    struct Offer {
        bool isInitialized;
        address buyer;
        uint256 price;
        uint64 expirationDate;
        uint256 counterofferId;
    }

    struct Counteroffer {
        address collection;
        uint256 nftId;
        uint256 offerId;
        uint256 price;
        uint64 expirationDate;
    }

    int128 public feeRatio = MathFees._npercent(int128(2));
    int128 public floorRatio = MathFees._npercent(int128(20));

    uint256 internal constant ONE_COPY = 1;
    uint64 internal constant ONE_DAY_IN_SECONDS = uint64(24 * 60 * 60);
    uint256 internal constant NO_COUNTER_OFFER = 0;

    uint256 public fusyBenefitsAccumulated;

    mapping(address => mapping(uint256 => NFTForSale)) public nftsListed;
    Counteroffer[] counteroffers;

    event NFTListed(
        address indexed seller,
        address indexed collection,
        uint256 nftId,
        uint256 price
    );
    event NFTSold(
        address indexed buyer,
        address indexed seller,
        address indexed collection,
        uint256 nftId,
        uint256 price
    );
    event OfferMade(
        address indexed buyer,
        address indexed collection,
        uint256 indexed nftId,
        uint256 offerId
    );
    event CounterofferMade(
        address indexed collection,
        uint256 indexed nftId,
        uint256 indexed offerId,
        uint256 counterofferId
    );
    event CounterofferTaken(
        uint256 indexed id,
        uint256 price,
        address indexed seller
    );
    event RootWithdrawal(address indexed beneficiary, uint256 amount);

    constructor() {}

    receive() external payable {}

    function withdraw() external onlyOwner {
        require(
            fusyBenefitsAccumulated > 0,
            "Marketplace: Nothing to withdraw."
        );
        uint256 amountToWithdraw = fusyBenefitsAccumulated;
        fusyBenefitsAccumulated = 0;
        payable(owner()).transfer(amountToWithdraw);
        emit RootWithdrawal(owner(), amountToWithdraw);
    }

    function setFeeRatio(
        int128 _percentageMultipliedBy2Up64AndTwoDecimals
    ) external onlyOwner {
        require(
            _percentageMultipliedBy2Up64AndTwoDecimals._verifyFeeRatioBounds()
        );
        int128 _feeRatio = _percentageMultipliedBy2Up64AndTwoDecimals
            ._computeFeeRatio();
        require(
            feeRatio != _feeRatio,
            "Marketplace: You are trying to set the same feeRatio."
        );
        feeRatio = _feeRatio;
    }

    function makeOffer(
        address collection,
        uint256 nftId,
        uint64 durationInDays
    ) external payable override {
        uint256 priceOffer = msg.value;
        require(
            _makeOfferRequirements(collection, nftId, priceOffer),
            "Marketplace: Error trying to make an offer."
        );
        address buyer = msg.sender;
        Offer memory offer = Offer({
            isInitialized: true,
            buyer: buyer,
            price: priceOffer,
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

    function _makeOfferRequirements(
        address collection,
        uint256 nftId,
        uint256 priceOffer
    ) private view returns (bool) {
        return
            isListed(collection, nftId) &&
            priceOffer >= minPriceOffer(collection, nftId);
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
        address buyer = msg.sender;
        address seller = nft.seller;
        uint256 moneyReceived = msg.value;
        uint256 moneyRequired = nft.price;
        require(
            _purchaseRequirements(
                collection,
                nftId,
                moneyReceived,
                moneyRequired
            ),
            "Marketplace: Error in the purchase."
        );
        delete nftsListed[collection][nftId];
        _transferRemaining(buyer, moneyReceived, moneyRequired);
        _payingBenefits(seller, moneyRequired);
        IERC1155 ierc1155 = IERC1155(collection);
        ierc1155.safeTransferFrom(
            address(this),
            msg.sender,
            nftId,
            ONE_COPY,
            ""
        );
        emit NFTSold(msg.sender, seller, collection, nftId, nft.price);
    }

    function _purchaseRequirements(
        address collection,
        uint256 nftId,
        uint256 moneyReceived,
        uint256 moneyRequired
    ) private view returns (bool) {
        return isListed(collection, nftId) && (moneyReceived >= moneyRequired);
    }

    function _transferRemaining(
        address user,
        uint256 moneyReceived,
        uint256 moneyRequired
    ) private {
        uint256 remaining = moneyReceived - moneyRequired;
        if (remaining > 0) {
            payable(user).transfer(remaining);
        }
    }

    function _payingBenefits(address seller, uint256 moneyRequired) private {
        uint256 fusyonaFee = getFusyonaFeeFor(moneyRequired);
        fusyBenefitsAccumulated += fusyonaFee;
        payable(seller).transfer(moneyRequired - fusyonaFee);
    }

    function getFusyonaFeeFor(
        uint256 netPayment
    ) public view returns (uint256) {
        return feeRatio.mulu(netPayment);
    }

    function list(
        address collection,
        uint256 nftId,
        uint256 price
    ) external override {
        address seller = msg.sender;
        require(
            _listedRequirements(seller, collection, nftId, price),
            "Marketplace: Error when listed"
        );
        IERC1155 ierc1155 = IERC1155(collection);
        ierc1155.safeTransferFrom(seller, address(this), nftId, ONE_COPY, "");
        NFTForSale storage newNFTforListing = nftsListed[collection][nftId];
        newNFTforListing.listed = true;
        newNFTforListing.price = price;
        newNFTforListing.seller = seller;
        emit NFTListed(seller, collection, nftId, price);
    }

    function _listedRequirements(
        address seller,
        address collection,
        uint256 nftId,
        uint256 price
    ) private view returns (bool) {
        return
            !isListed(collection, nftId) &&
            _isTheOwner(seller, collection, nftId) &&
            (price > 0);
    }

    function isListed(
        address collection,
        uint256 nftId
    ) public view returns (bool) {
        NFTForSale storage nftTarget = nftsListed[collection][nftId];
        return nftTarget.listed;
    }

    function _isTheOwner(
        address seller,
        address collection,
        uint256 nftId
    ) private view returns (bool) {
        IERC1155 ierc1155 = IERC1155(collection);
        return ierc1155.balanceOf(seller, nftId) > 0;
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
            offer.expirationDate > block.timestamp,
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
        Offer memory offer = _getOffer(collection, nftId, offerId);
        return _getCounterOfferById(offer.counterofferId);
    }

    function _getCounterOfferById(
        uint256 id
    ) private view returns (Counteroffer memory) {
        return counteroffers[id - 1];
    }

    function _getOffer(
        address collection,
        uint256 nftId,
        uint256 offerId
    ) private view returns (Offer memory) {
        return nftsListed[collection][nftId].offers[offerId];
    }

    function takeCounteroffer(uint256 id) external payable override {
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
        require(
            offer.price + msg.value >= counteroffer.price,
            "Marketplace: Insufficient funds"
        );

        NFTForSale storage nft = nftsListed[counteroffer.collection][
            counteroffer.nftId
        ];
        nft.listed = false;

        address seller = nft.seller;

        _transferRemaining(
            msg.sender,
            offer.price + msg.value,
            counteroffer.price
        );
        _payingBenefits(seller, counteroffer.price);

        IERC1155 ierc1155 = IERC1155(counteroffer.collection);
        ierc1155.safeTransferFrom(
            address(this),
            msg.sender,
            counteroffer.nftId,
            ONE_COPY,
            ""
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

    function _getOfferByCounterofferId(
        uint256 id
    ) private view returns (Offer memory) {
        Counteroffer memory counteroffer = _getCounterOfferById(id);
        address collection = counteroffer.collection;
        uint256 nftId = counteroffer.nftId;
        uint256 offerId = counteroffer.offerId;
        return _getOffer(collection, nftId, offerId);
    }
}
