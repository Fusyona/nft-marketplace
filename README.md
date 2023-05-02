<h1> FUSYONA NFT Marketplace <h1/>
# Marketplace Contract
 ## Overview
The Marketplace Contract is a Solidity smart contract that enables users to buy and sell NFTs (non-fungible tokens) on the Ethereum blockchain. Users can list their NFTs for sale and buyers can purchase them using ETH (Ether). The contract supports offers, where a buyer can make an offer for a listed NFT.
 ## Version Details
The contract was developed using Solidity version  `0.8.0` .
 ## Dependencies
The contract does not import any external dependencies.
 ## Technologies
The Marketplace Contract is built on the Ethereum blockchain using Solidity smart contracts.
 ## Architecture and Design Patterns
The Marketplace Contract uses a simple architecture pattern, where the main logic is contained in one smart contract. The contract uses basic Solidity functions for buying, selling, and making offers on NFTs.
 ## Functions
### Public Functions
####  `list(address collection, uint256 tokenId, uint256 price)` 
Lists an NFT for sale.
##### Inputs
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
-  `price`  - uint256 - The price of the NFT in ETH.
##### Outputs
- None
 ####  `buy(address collection, uint256 tokenId)` 
Purchases an NFT listed for sale.
##### Inputs
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
##### Outputs
- None
 ####  `makeOffer(address collection, uint256 tokenId, uint256 priceOffer)` 
Makes an offer on an NFT listed for sale.
##### Inputs
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
-  `priceOffer`  - uint256 - The price offered for the NFT in ETH.
##### Outputs
- None
 ####  `cancelOffer(address collection, uint256 tokenId)` 
Cancels an offer on an NFT.
##### Inputs
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
##### Outputs
- None
 ####  `setMinOfferPrice(uint256 value)` 
Sets the minimum offer price for an NFT.
##### Inputs
-  `value`  - uint256 - The new minimum offer price in ETH.
##### Outputs
- None
 ####  `setFeeRatio(int128 value)` 
Sets the fee ratio for the contract.
##### Inputs
-  `value`  - int128 - The new fee ratio.
##### Outputs
- None
 ####  `withdrawBenefits()` 
Withdraws the accumulated fees from the contract.
##### Inputs
- None
##### Outputs
- None
 ### Getter Functions
####  `getListing(address collection, uint256 tokenId)` 
Returns the current listing information for an NFT.
##### Inputs
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
##### Outputs
-  `listed`  - bool - Whether or not the NFT is currently listed for sale.
-  `price`  - uint256 - The current price of the NFT in ETH.
-  `seller`  - address - The address of the seller of the NFT.
-  `offers`  - address[] - The addresses of the buyers who have made offers on the NFT.
 ####  `getOffer(address collection, uint256 tokenId, address buyer)` 
Returns the current offer information for an NFT.
##### Inputs
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
-  `buyer`  - address - The address of the buyer who made the offer.
##### Outputs
-  `priceOffer`  - uint256 - The price offered by the buyer in ETH.
 ####  `getMinOfferPrice()` 
Returns the current minimum offer price for an NFT.
##### Inputs
- None
##### Outputs
-  `minOfferPrice`  - uint256 - The current minimum offer price in ETH.
 ####  `getFeeRatio()` 
Returns the current fee ratio for the contract.
##### Inputs
- None
##### Outputs
-  `feeRatio`  - int128 - The current fee ratio.
 ## Events
####  `NFTListed(address indexed seller, address indexed collection, uint256 indexed tokenId, uint256 price)` 
Emitted when an NFT is listed for sale.
##### Inputs
-  `seller`  - address - The address of the seller.
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
-  `price`  - uint256 - The price of the NFT in ETH.
 ####  `NFTSold(address indexed buyer, address indexed seller, address indexed collection, uint256 tokenId, uint256 price)` 
Emitted when an NFT is sold.
##### Inputs
-  `buyer`  - address - The address of the buyer.
-  `seller`  - address - The address of the seller.
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
-  `price`  - uint256 - The price of the NFT in ETH.
 ####  `OfferMade(address indexed buyer, address indexed collection, uint256 indexed tokenId, uint256 priceOffer)` 
Emitted when an offer is made on an NFT.
##### Inputs
-  `buyer`  - address - The address of the buyer.
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
-  `priceOffer`  - uint256 - The price offered for the NFT in ETH.
 ####  `OfferCancelled(address indexed buyer, address indexed collection, uint256 indexed tokenId)` 
Emitted when an offer is cancelled on an NFT.
##### Inputs
-  `buyer`  - address - The address of the buyer.
-  `collection`  - address - The address of the NFT collection.
-  `tokenId`  - uint256 - The ID of the NFT.
 ####  `FeeWithdrawn(address indexed owner, uint256 amount)` 
Emitted when the accumulated fees are withdrawn from the contract.
##### Inputs
-  `owner`  - address - The address of the owner.
-  `amount`  - uint256 - The amount of fees withdrawn in ETH.
 ## Additional Notes or Documentation
The Marketplace Contract is a simple implementation of a marketplace for NFTs on the Ethereum blockchain. It allows for basic buying, selling, and making offers on NFTs, with a fee system to incentivize the contract owner. The contract can be used as a building block for more complex NFT marketplaces.