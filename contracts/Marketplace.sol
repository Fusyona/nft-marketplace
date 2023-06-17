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
        address buyer;
        uint256 priceOffer;
        uint64 expirationDate;
    }

    int128 public feeRatio = MathFees._npercent(int128(2));
    int128 public floorRatio = MathFees._npercent(int128(20));

    uint256 internal constant ONE_COPY = 1;
    uint64 internal constant ONE_DAY_IN_SECONDS = uint64(24 * 60 * 60);

    uint256 public fusyBenefitsAccumulated;

    mapping(address => mapping(uint256 => NFTForSale)) public nftsListed;

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

    function takeOffer(
        address collection,
        uint256 tokenId,
        uint256 indexOfOfferMapping
    ) external override {
        NFTForSale storage nft = nftsListed[collection][tokenId];
        Offer memory targetOffer = nft.offers[indexOfOfferMapping];
        _takeOfferRequirements(nft, targetOffer, indexOfOfferMapping);
        address seller = nft.seller;
        address buyer = targetOffer.buyer;
        uint256 price = targetOffer.priceOffer;
        nft.listed = false;
        _trade(buyer, seller, collection, tokenId, price);
    }

    function _takeOfferRequirements(
        NFTForSale storage nft,
        Offer memory targetOffer,
        uint256 indexOfOfferMapping
    ) private view {
        address seller = nft.seller;
        bool listed = nft.listed;
        uint256 totalOffers = nft.totalOffers;
        uint64 expirationDate = targetOffer.expirationDate;
        require(
            msg.sender == seller,
            "Marketplace: Sender should be the seller"
        );
        require(listed, "Marketplace: NFT not found");
        require(
            totalOffers > indexOfOfferMapping,
            "Marketplace: Offer doesn't exist"
        );
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
        IERC1155 ierc1155 = IERC1155(collection);
        ierc1155.safeTransferFrom(address(this), buyer, nftId, ONE_COPY, "");
        emit NFTSold(buyer, seller, collection, nftId, priceOfTrade);
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
            buyer: buyer,
            priceOffer: priceOffer,
            expirationDate: uint64(block.timestamp) +
                durationInDays *
                ONE_DAY_IN_SECONDS
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
        address collectinn,
        uint256 nftId
    ) public view returns (uint256) {
        NFTForSale storage nft = nftsListed[collectinn][nftId];
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
            _purchaseRequirements(nft, moneyReceived, moneyRequired),
            "Marketplace: Error in the purchase."
        );
        nft.listed = false;
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
        NFTForSale storage nft,
        uint256 moneyReceived,
        uint256 moneyRequired
    ) private view returns (bool) {
        return nft.listed && (moneyReceived >= moneyRequired);
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
        uint256 fusyonaFee = _fusyonaFee(moneyRequired);
        fusyBenefitsAccumulated += fusyonaFee;
        payable(seller).transfer(moneyRequired - fusyonaFee);
    }

    function _fusyonaFee(uint256 netPayment) public view returns (uint256) {
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
}
