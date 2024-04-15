// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NftIdRetriever {

    function tokensOfOwner(IERC721 collection, address owner, uint startId, uint endId)
    external 
    view 
    returns (uint[] memory) {
        uint[] memory ownedIds;
        uint index;

        for (startId; startId <= endId; ++startId) {
            if (collection.ownerOf(startId) == owner) {
                ownedIds[index] == startId;                
            }
            ++index;
        }
        return ownedIds;    
    }
}