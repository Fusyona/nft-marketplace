// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity  ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IMarketplace.sol";
import "./ABDKMath64x64.sol";
import "./MathFees.sol";

contract Marketplace is IMarketplace, ERC1155Holder, Ownable {
    using ABDKMath64x64 for int128;
    using MathFees for int128;

    int128 public feeRatio = MathFees._2percent();    

    uint256 ONE_COPY = 1;
    
    struct NFTForSale {
        bool listed;
        uint256 price;
        address seller;
        address[] offers;
    }

    mapping(address => mapping(uint256 => NFTForSale)) public nftsListed;

    event NFTListed(address indexed seller, address indexed collection, uint256 nftId, uint256 price);
    event NFTSold(address indexed buyer, address indexed seller, address indexed collection, uint256 nftId, uint256 price);

    constructor() {
        
    }

    receive() external payable{}

    function setFeeRatio(int128 _percentageMultipliedBy2Up64AndTwoDecimals) external onlyOwner {
        require(_percentageMultipliedBy2Up64AndTwoDecimals._verifyFeeRatioBounds());  
        int128 _feeRatio = _percentageMultipliedBy2Up64AndTwoDecimals._computeFeeRatio();
        require(feeRatio != _feeRatio, "Marketplace: You are trying to set the same feeRatio.");
        feeRatio =_feeRatio;
  }

    function buy(address collection, uint256 nftId) external override payable {
        NFTForSale memory nft = nftsListed[collection][nftId];
        address buyer = msg.sender;
        uint256 moneyReceived = msg.value;
        uint256 moneyRequired = nft.price;
        require(_purchaseRequirements(collection, nftId, moneyReceived, moneyRequired), "Marketplace: Error in the purchase.");
        delete nftsListed[collection][nftId];
        _transferRemaining(buyer, moneyReceived, moneyRequired);
        _payingBenefits(nft.seller, moneyRequired);
        IERC1155 ierc1155 = IERC1155(collection);
        ierc1155.safeTransferFrom(address(this), msg.sender, nftId, ONE_COPY, "");
        emit NFTSold(msg.sender, nft.seller, collection, nftId, nft.price);

    } 

    function _purchaseRequirements(address collection, uint256 nftId, uint256 moneyReceived, uint256 moneyRequired) private view returns (bool) {
        return _isListed(collection, nftId) && (moneyReceived >= moneyRequired);
    } 

    function _transferRemaining(address user, uint256 moneyReceived, uint256 moneyRequired) private {
    uint256 remaining = moneyReceived - moneyRequired;
    if (remaining > 0) {
        payable(user).transfer(remaining);
        }
    }
    
    function _payingBenefits(address seller, uint256 moneyRequired) private {
        uint256 fusyonaFee = _fusyonaFee(moneyRequired);
        payable(seller).transfer(moneyRequired - fusyonaFee);
    }

    function _fusyonaFee(uint256 netPayment) public view returns(uint256) {
        return feeRatio.mulu(netPayment);
    }

    function list(address collection, uint256 nftId, uint256 price) public override {
        address seller = msg.sender;
        require(_listedRequirements(seller, collection, nftId, price), "Marketplace: Error when listed");
        IERC1155 ierc1155 = IERC1155(collection);
        ierc1155.safeTransferFrom(seller, address(this), nftId, ONE_COPY, "");
        NFTForSale memory newNFTforListing;
        newNFTforListing.listed = true;
        newNFTforListing.price = price;
        newNFTforListing.seller = seller;
        nftsListed[collection][nftId] = newNFTforListing;
        emit NFTListed(seller, collection, nftId, price);
    }

    function _listedRequirements(address seller, address collection, uint256 nftId, uint256 price) private view returns (bool) {
        return !_isListed(collection, nftId) && _isTheOwner(seller, collection, nftId) && _isPriceGreaterThan0(price);

    }

    function _isListed(address collection, uint256 nftId) private view returns (bool) {
        NFTForSale memory nftTarget = nftsListed[collection][nftId];
        return nftTarget.listed;
    }

    function _isTheOwner(address seller, address collection, uint256 nftId) private view returns (bool) {
        IERC1155 ierc1155 = IERC1155(collection);
        return ierc1155.balanceOf(seller, nftId) > 0;
    }

    function _isPriceGreaterThan0(uint256 price) private pure returns (bool) {
        return price > 0;
    } 

}

