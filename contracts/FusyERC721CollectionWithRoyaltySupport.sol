// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

contract FusyERC721CollectionWithRoyaltySupport is
    ERC721,
    ERC721URIStorage,
    ERC2981,
    Ownable
{
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    string public baseUri;
    uint256 public totalMintedNFTs;
    uint64 immutable cap;
    uint16 public constant maxFeeNumerator = 1000;

    constructor(
        string memory baseUri_,
        uint64 cap_,
        string memory name_,
        string memory symbol_,
        uint96 feeNumerator_
    ) ERC721(name_, symbol_) {
        require(
            feeNumerator_ <= maxFeeNumerator,
            "Collection: Royalties should be less than 10%"
        );
        uint96 feeNumerator = feeNumerator_;
        baseUri = baseUri_;
        cap = cap_;
        _setDefaultRoyalty(owner(), feeNumerator);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }

    function createNFT() public {
        _verifyCap();
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        totalMintedNFTs += 1;
        _safeMint(msg.sender, tokenId);
    }

    function _verifyCap() public view {
        require(
            totalMintedNFTs < uint256(cap),
            "Collection: Impossible to mint another NFT"
        );
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        _resetTokenRoyalty(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
