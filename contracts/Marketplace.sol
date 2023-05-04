// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity  ^0.8.0;

import "./IMarketplace.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract Marketplace is IMarketplace, ERC1155Holder {

    uint256 ONE_COPY = 1;    

    struct NFTForSale {
        bool listed;
        uint256 price;
        address seller;
        address[] offers;
    }

    mapping(address => mapping(uint256 => NFTForSale)) public nftsListed;

    event NFTListed(address indexed seller, address indexed collection, uint256 nftId, uint256 price);
    
    constructor() {
        
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
        (bool listed, , ,  ) = getListing(collection, nftId);
        return listed;
    }

    function _isTheOwner(address seller, address collection, uint256 nftId) private view returns (bool) {
        IERC1155 ierc1155 = IERC1155(collection);
        return ierc1155.balanceOf(seller, nftId) > 0;
    }

    function _isPriceGreaterThan0(uint256 price) private pure returns (bool) {
        return price > 0;
    } 

    function getListing(address collection, uint256 nftId) public view returns (
        bool, 
        uint256, 
        address, 
        address[] memory
    ) {
        NFTForSale storage nftForSale = nftsListed[collection][nftId];
        return (
            nftForSale.listed,
            nftForSale.price,
            nftForSale.seller,
            nftForSale.offers
            );
    }
}

