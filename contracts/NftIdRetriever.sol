// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NftIdRetriever {

    function tokensOfOwner(
        address collectionAddress,
        address owner,
        uint startId,
        uint endId
    ) external view returns (uint[] memory) {
        IERC721 collection = IERC721(collectionAddress);
        uint tokenBalance= collection.balanceOf(owner);
        uint[] memory ownedIds = new uint[](tokenBalance);
        uint index;

        while (startId <= endId && index <= tokenBalance) {
            if (collection.ownerOf(startId) == owner) {
                ownedIds[index] = startId;
                ++index;                
            }
            ++startId;           
        }
        return ownedIds;    
    }
}
