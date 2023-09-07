// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

interface IMarketplace {
    function list(address collection, uint256 tokenId, uint256 price) external;

    function isListed (
        address collection,
        uint256 tokenId
    ) external view returns (bool);

    function getNftInfo(
        address collection,
        uint256 tokenId
    ) external view returns (NftInfo calldata);

    struct NftInfo {
        bool listed;
        uint256 price;
        address seller;
        uint256 totalOffers;
    }

    function changePriceOf(
        address collection,
        uint256 tokenId,
        uint256 newPrice
    ) external;

    function buy(address collection, uint256 tokenId) external payable;

    function getOffer(
        address collection,
        uint256 nftId,
        uint256 offerId
    ) external view returns (Offer calldata);

    struct Offer {
        bool isInitialized;
        address buyer;
        uint256 price;
        uint64 expirationDate;
        uint256 counterofferId;
    }

    function cancelOffer(
        address collection,
        uint256 tokenId,
        uint256 indexOfOfferMapping
    ) external;

    function takeOffer(
        address collection,
        uint256 tokenId,
        uint256 indexOfOfferMapping
    ) external;

    function makeCounteroffer(
        address collection,
        uint256 tokenId,
        uint256 offerId,
        uint256 newPriceOffer,
        uint64 durationInDays
    ) external;

    function getCounteroffer(
        address collection,
        uint256 nftId,
        uint256 offerId
    ) external view returns (Counteroffer calldata);

    function getCounteroffer(
        uint256 counterofferId
    ) external view returns (Counteroffer calldata);

    struct Counteroffer {
        address collection;
        uint256 nftId;
        uint256 offerId;
        uint256 price;
        uint64 expirationDate;
    }

    function takeCounteroffer(uint256 id) external payable;

    function getFusyonaFeeFor(uint256 price) external view returns (uint256);

    function setFeeRatioFromPercentage(uint8 percentage) external;

    function feeRatio() external view returns (int128);

    function withdraw() external;

    function setFloorRatioFromPercentage(uint8 percentage) external;

    function floorRatio() external view returns (int128);

    function fusyBenefitsAccumulated() external view returns (uint256);

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
    event NFTPriceChanged(
        address indexed collection,
        uint256 indexed nftId,
        uint256 newPrice
    );
    event CancelledOffer(
        address indexed collection,
        uint256 indexed tokenId,
        uint256 indexOfOfferMapping,
        uint256 priceOffer,
        address indexed buyer
    );

    event RoyaltyPayment(
        address indexed collection, 
        uint256 indexed tokenId, 
        address indexed beneficiary, 
        uint256 royalty
    );
}
