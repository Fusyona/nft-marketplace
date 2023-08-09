// SPDX-License-Identifier: SEE LICENSE IN LICENSE

pragma solidity ^0.8.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC721Collection is ERC721, Ownable {
    constructor(uint256[] memory ids) ERC721("Mock721", "M721") {
        for (uint256 i = 0; i < ids.length; i++) {
            _safeMint(_msgSender(), ids[i]);
        }
    }

    function mint(
        address account,
        uint256 id,
        bytes memory data
    ) public onlyOwner {
        _safeMint(account, id, data);
    }
}
