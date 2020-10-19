//SPDX-License-Identifier: Unlicense
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

contract GameAssets is ERC721, Ownable {
    using EnumerableSet for EnumerableSet.UintSet;

    EnumerableSet.UintSet private tokenIdsSet;

    constructor() ERC721("Startups", "AST") public Ownable() {
    }

    /**
    * @dev Safely mints tokenId and transfers it to to.
    *
    * Requirements:
    *
    * - d* - tokenId must not exist
    */
    function safeMint(address to, uint256 tokenId) public onlyOwner  {
        _safeMint(to, tokenId);
        tokenIdsSet.add(tokenId);
    }

    function reset() public onlyOwner {
        uint256 totalTokens = totalSupply();
        for (uint i = 0; i < totalTokens; i++) {
            uint256 tokenId = tokenByIndex(i);
            _burn(tokenId);
        }
        assert(totalSupply() == 0);
    }

}