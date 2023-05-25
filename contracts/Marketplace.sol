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
        uint256 priceOffer
    );

    constructor() {}

    receive() external payable {}

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
            buyer: buyer,
            priceOffer: priceOffer,
            expirationDate: uint64(block.timestamp) +
                durationInDays *
                ONE_DAY_IN_SECONDS
        });
        NFTForSale storage nft = nftsListed[collection][nftId];
        nft.offers[nft.totalOffers] = offer;
        nft.totalOffers += 1;
        emit OfferMade(buyer, collection, nftId, priceOffer);
    }

    function _makeOfferRequirements(
        address collection,
        uint256 nftId,
        uint256 priceOffer
    ) private view returns (bool) {
        return
            _isListed(collection, nftId) &&
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
        return _isListed(collection, nftId) && (moneyReceived >= moneyRequired);
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
            !_isListed(collection, nftId) &&
            _isTheOwner(seller, collection, nftId) &&
            _isPriceGreaterThan0(price);
    }

    function _isListed(
        address collection,
        uint256 nftId
    ) private view returns (bool) {
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

    function _isPriceGreaterThan0(uint256 price) private pure returns (bool) {
        return price > 0;
    }
}
