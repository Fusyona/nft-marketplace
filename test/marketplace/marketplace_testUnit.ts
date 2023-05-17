import {deployments, ethers} from "hardhat";
import {assert, expect} from "chai";
import {Marketplace} from "../../scripts/marketplace";
import { Contract, Signer, BigNumber } from "ethers";
import { Address, Deployment } from "hardhat-deploy/types";

describe("Testing Marketplace Smart Contract", () => {
    let signer:Signer;
    let marketplaceDeployment: Deployment;
    let mockERC1155CollectionDeployment:Deployment;
    
    let BN = BigNumber;
    const twoUp64 = BN.from(2).pow(64);
    const _2percent = BN.from(2).mul(twoUp64).div(BN.from(100));

    beforeEach(async () => {
        await deployments.fixture(["Marketplace", "MockERC1155Collection"]); 
        await setInstances();
        await defaultSigner();
        
    });

    async function defaultSigner() {
        const signers = await ethers.getSigners();
        signer = signers[0];
    }

    async function getAnotherSigner(x:number){
        if (x===0) {
            throw new Error("O is the defaultSigner's index.");
        }
        const signers = await ethers.getSigners();
        return signers[x]
    }



    async function setInstances() {
        marketplaceDeployment = await deployments.get("Marketplace");
        mockERC1155CollectionDeployment = await deployments.get("MockERC1155Collection");
    }

    async function tApprove(marketplace:Marketplace) {
        const collectionAddress = mockERC1155CollectionDeployment.address;
        const mockCollection = await ethers.getContractAt("ERC1155", collectionAddress);
        try{
            await mockCollection.setApprovalForAll(marketplace.contractAddress, true);
        }catch(error){
            throw error;
        }
    }

    async function tList(marketplace:Marketplace, collectionAddress:Address, nftId:string, price:string){
        await marketplace.list(collectionAddress, nftId, price);  
    }

    async function tBalanceOf(account:Address, nftId:string) {
        const collectionAddress = mockERC1155CollectionDeployment.address;
        const mockCollection = await ethers.getContractAt("ERC1155", collectionAddress);
        try {
            return await mockCollection.balanceOf(account, nftId);
        }catch(error) {
            console.error(error);
        }

        }

    it("Marketplace should be deployed, therefore, it has linked an address", async () =>  {
        const zeroAddress = ethers.constants.AddressZero;
        const marketplaceAddress = marketplaceDeployment.address;
        assert.notEqual(marketplaceAddress, zeroAddress, "Wrong Marketplace address deployed");
    });

    describe("List functions's tests.", ()=> {
        it("A NFT should be listed using list function.", async () => {
            const marketplace = new Marketplace(marketplaceDeployment.address, signer);
            
            const tvlBeforeList = await marketplace.totalOfNFTListed();
            const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();
    
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());
    
            const tvlAfterList = await marketplace.totalOfNFTListed();
            const _tvlAfterList = BN.from(tvlAfterList).toNumber();
            assert.equal(_tvlAfterList, _tvlBeforeList + 1, "_tvlAfterList should be increased plus one");
        });
    
        it("If there are more than two NFT in the marketplace the function totalOfNFTListed should returns 2", async () => {
            
            const marketplace = new Marketplace(marketplaceDeployment.address, signer);
            
            const tvlBeforeList = await marketplace.totalOfNFTListed();
            const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();
    
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = "1";
            const nftId2 = "2";
            const price = ethers.utils.parseEther("1");
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId1, price.toString());
            await tList(marketplace, collectionAddress, nftId2, price.toString());
           
    
            const tvlAfterList = await marketplace.totalOfNFTListed();
            const _tvlAfterList = BN.from(tvlAfterList).toNumber();
           
            assert.equal(_tvlAfterList, _tvlBeforeList + 2, "_tvlAfterList should be increased plus two");
        });
    
        it("An exception should revert if an user try to list twice the same NFT.", async () => {
            const marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = "1";
            const price = ethers.utils.parseEther("1");
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId1, price.toString());
            

            await expect (tList(marketplace, collectionAddress, nftId1, price.toString())).to.be.revertedWith(
                'Marketplace: Error when listed'
            );  
        
        });
    
        it("If an user owner of a NFT try to list that nft before it grants to Marketplace rigths over its token, then an exception should be throwed.", async () => {
            const marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = "1";
            const price = ethers.utils.parseEther("1");
            
            await expect(tList(marketplace, collectionAddress, nftId1, price.toString())).to.be.revertedWith(
                "ERC1155: caller is not token owner or approved"
                );  
        });
    
    });
    
    describe(
        "Buy function's tests", () => {
        it("If one NFT is bought then the totalOfNFT listed should decrease in less one.", async () => {
            let marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());

            const buyer = await getAnotherSigner(1);
            marketplace = new Marketplace(marketplaceDeployment.address, buyer);

            const _tvlBeforeBuy = BN.from(await marketplace.totalOfNFTListed()).toNumber();
            await marketplace.buy(collectionAddress, nftId);
            const _tvlAfterBuy = BN.from(await marketplace.totalOfNFTListed()).toNumber();
            assert.equal(_tvlAfterBuy, (_tvlBeforeBuy - 1), "The totalOfNFTListed should decreased in less one.");


        });

        it("After the purchase the Marketplace's ether balance should be equal to 2%NFTprice.", async () => {
            let marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            const actualBalanceOfMarketplaceBeforeBuy = await ethers.provider.getBalance(marketplace.contractAddress);
            
            const expectedBalanceOfMarketplace = actualBalanceOfMarketplaceBeforeBuy.add(price.mul(_2percent).div(twoUp64));

            const collectionAddress = mockERC1155CollectionDeployment.address;
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());

            const buyer = await getAnotherSigner(1);
            marketplace = new Marketplace(marketplaceDeployment.address, buyer);
            
            await marketplace.buy(collectionAddress, nftId);
            
            const actualBalanceOfMarketplace = await ethers.provider.getBalance(marketplace.contractAddress);
            assert.equal(actualBalanceOfMarketplace.toString(), expectedBalanceOfMarketplace.toString(), "The balance of Marketplace is not equal to 2%NFTprice.");
            
        });
        
        it("After the purchase the Seller's ether balance should increase in NFTprice - 2%NFTprice.", async ()=> {
            let marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;            
            const _2percentPrice = _2percent.mul(price).div(twoUp64);
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());
            
            const balanceOfSellerAfterList = await ethers.provider.getBalance(await signer.getAddress());
            const expectedBalanceOfSeller = balanceOfSellerAfterList.add(price.sub(_2percentPrice));
            
            const buyer = await getAnotherSigner(1);
            marketplace = new Marketplace(marketplaceDeployment.address, buyer);
            
            await marketplace.buy(collectionAddress, nftId);
            
            const actualBalanceOfSeller = await ethers.provider.getBalance(await signer.getAddress());
            assert.equal(actualBalanceOfSeller.toString(), expectedBalanceOfSeller.toString(), "The balance of Seller is not equal to NFTprice - 2%NFTprice.");
            
        });

        it("Buyer's NFT balance previously to the purchase should be equal to 0.", async ()=> {
            let marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());
            
            const buyer = await getAnotherSigner(1);
            marketplace = new Marketplace(marketplaceDeployment.address, buyer);
            const balanceOfBuyerInNFT = (await tBalanceOf(buyer.address, nftId))?.toString();
            
            assert.equal(balanceOfBuyerInNFT, "0", "Buyer's NFT balance previusly to the purchase should be equal to 0.");
            
        
        });

        it("Buyer's NFT balance after the purchase should increase in one.", async ()=> {
            let marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());
            
            const buyer = await getAnotherSigner(1);
            marketplace = new Marketplace(marketplaceDeployment.address, buyer);
            
            await marketplace.buy(collectionAddress, nftId);
            
            const balanceOfBuyerInNFT = (await tBalanceOf(buyer.address, nftId))?.toString();
            assert.equal(balanceOfBuyerInNFT, "1", "Buyer's NFT balance after the purchase should increase in 1.");
            
        });

        it("If the buyer haven't enough money to purchase the NFT at its price, the transacton should revert.", async () =>{  
            let marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const nftId = "1";
            const price = ethers.utils.parseEther("10000.1");

            const collectionAddress = mockERC1155CollectionDeployment.address;            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());
            
            const buyer = await getAnotherSigner(1);
            marketplace = new Marketplace(marketplaceDeployment.address, buyer);
            
            const wrappedFunction = async () => {
                await marketplace.buy(collectionAddress, nftId); 
            };
            expect(wrappedFunction).to.throw;
            
        });

        it("If a buyer try to buy an unlisted token, the transaction should revert.", async () => {
     
            const collectionAddress = mockERC1155CollectionDeployment.address;            
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(marketplaceDeployment.address, buyer);
            const nftId = "1";

            const wrappedFunction = async () => {
                await marketplace.buy(collectionAddress, nftId);
            };

            expect(wrappedFunction).to.throw;
            
        });

        it("After unlisted a NFT it's not possible make the same purchase, avoiding double spent.", async () => {
            let marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());
            
            const buyer = await getAnotherSigner(1);
            const scammer = await getAnotherSigner(2);
            
            marketplace = new Marketplace(marketplaceDeployment.address, buyer);
            await marketplace.buy(collectionAddress, nftId);

            marketplace = new Marketplace(marketplaceDeployment.address, scammer);
            
            const wrappedFunction = async () => {
                await marketplace.buy(collectionAddress, nftId);
            };

            expect(wrappedFunction).to.throw;
         
        });




    });

});