import { ethers } from "hardhat";
import { Address, Receipt } from "hardhat-deploy/types";
import { EventFilter, Event, Contract, Signer, BigNumber } from "ethers";

interface NFTForSale {
    listed: Boolean;
    price: BigNumber;
    seller: Address;
    offers: Record<string, Offer>;
    totalOffers: BigNumber;
}

interface Offer {
    buyer: Address;
    priceOffer: BigNumber;
    expirationDate: number;
}

class Marketplace {
    contractAddress: Address;
    signer: Signer;

    constructor(contractAddress: Address, signer: Signer) {
        this.contractAddress = contractAddress;
        this.signer = signer;
    }

    async totalOfNFTListed(): Promise<String> {
        try {
            const allNFTListedEventEmitted = await this.getEvents("NFTListed");
            const allNFTSoldEventEmitted = await this.getEvents("NFTSold");
            const nftsListed = allNFTListedEventEmitted.length;
            const nftsSold = allNFTSoldEventEmitted.length;
            if (nftsListed < nftsSold) {
                throw new Error("NFTSold is greater than NFTListed.");
            }
            return (nftsListed - nftsSold).toString();
        } catch (error: any) {
            console.error(error.message);
            throw error;
        }
    }

    async list(
        collectionAddress: Address,
        nftId: string,
        price: string
    ): Promise<String> {
        try {
            const receipt = await (
                await this.instance()
            ).list(collectionAddress, nftId, price);
            return this.plotUri(await receipt.wait());
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async buy(collectionAddress: Address, nftId: string): Promise<String> {
        try {
            const dataNFT = await this.getDataNFT(collectionAddress, nftId);
            const receipt = await (
                await this.instance()
            ).buy(collectionAddress, nftId, { value: dataNFT.price });
            return this.plotUri(await receipt.wait());
        } catch (error: any) {
            throw error;
        }
    }

    async makeOffer(
        collectionAddress: Address,
        nftId: string,
        priceOffer: BigNumber,
        durationInDays: number
    ): Promise<String> {
        try {
            const receipt = await (
                await this.instance()
            ).makeOffer(collectionAddress, nftId, durationInDays, {
                value: priceOffer,
            });
            return this.plotUri(await receipt.wait());
        } catch (error: any) {
            throw error;
        }
    }

    async offersOf(collectionAddress: Address, nftId: string): Promise<String> {
        try {
            const dataNFT = await this.getDataNFT(collectionAddress, nftId);
            return dataNFT.totalOffers.toString();
        } catch (error: any) {
            throw error;
        }
    }

    async getDataNFT(
        collectionAddress: Address,
        nftId1: string
    ): Promise<NFTForSale> {
        try {
            const dataNFT: NFTForSale = await (
                await this.instance()
            ).nftsListed(collectionAddress, nftId1);
            if (dataNFT.listed === false) {
                throw new Error("NFT has not been listed yet");
            } else {
                return dataNFT;
            }
        } catch (error: any) {
            if ("message" in error) {
                throw error.message;
            }
            throw error;
        }
    }

    private plotUri(receipt: Receipt) {
        return this.uriScanner(receipt.transactionHash);
    }

    uriScanner(txHash: string) {
        return `https://mumbai.polygonscan.com/tx/${txHash}`;
    }

    private async getEvents(eventName: string): Promise<Event[]> {
        const marketplaceInstance: Contract = await this.instance();
        const events = await marketplaceInstance.queryFilter(eventName);
        return events;
    }

    private async instance(): Promise<Contract> {
        try {
            const instanceRetrieved = await ethers.getContractAt(
                "Marketplace",
                this.contractAddress,
                this.signer
            );
            return instanceRetrieved;
        } catch (error: any) {
            throw error;
        }
    }
}

export { Marketplace };
