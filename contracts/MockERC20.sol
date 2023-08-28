// SPDX-License-Identifier: MIT

pragma solidity ^0.8.1;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract MockERC20 is ERC20PresetMinterPauser {
    constructor(
        address[] memory beneficiaries
    ) ERC20PresetMinterPauser("Token", "TKN") {
        for (uint i = 0; i < beneficiaries.length; i++)
            _mint(beneficiaries[i], 100_000_000 * 10 ** decimals());
    }
}
