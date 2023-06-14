import { ethers } from "hardhat";
import { Address, Receipt } from "hardhat-deploy/types";
import { Event, Contract, Signer, BigNumber } from "ethers";

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

    async fusyBenefitsAccumulated(): Promise<BigNumber> {
        try {
            return await (await this.instance()).fusyBenefitsAccumulated();
        } catch (error) {
            throw error;
        }
    }

    async totalOfNFTListed(): Promise<number> {
        try {
            const allNFTListedEventEmitted = await this.getEvents("NFTListed");
            const allNFTSoldEventEmitted = await this.getEvents("NFTSold");
            const nftsListed = allNFTListedEventEmitted.length;
            const nftsSold = allNFTSoldEventEmitted.length;
            if (nftsListed < nftsSold) {
                throw new Error("NFTSold is greater than NFTListed.");
            }
            return nftsListed - nftsSold;
        } catch (error: any) {
            console.error(error.message);
            throw error;
        }
    }

    async withdraw(): Promise<Receipt> {
        try {
            const receipt = await (await this.instance()).withdraw();
            return await receipt.wait();
        } catch (error) {
            throw error;
        }
    }

    async list(
        collectionAddress: Address,
        nftId: string,
        price: string
    ): Promise<Receipt> {
        try {
            const receipt = await (
                await this.instance()
            ).list(collectionAddress, nftId, price);
            return await receipt.wait();
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
            return await receipt.wait();
        } catch (error: any) {
            throw error;
        }
    }

    async makeOffer(
        collectionAddress: Address,
        nftId: string,
        priceOffer: BigNumber,
        durationInDays: number
    ): Promise<Receipt> {
        try {
            const receipt = await (
                await this.instance()
            ).makeOffer(collectionAddress, nftId, durationInDays, {
                value: priceOffer,
            });
            return await receipt.wait();
        } catch (error: any) {
            throw error;
        }
    }

    async takeOffer(
        collectionAddress: Address,
        nftId: string,
        indexOfOfferMapping: BigNumber
    ): Promise<Receipt> {
        try {
            const receipt = await (
                await this.instance()
            ).takeOffer(collectionAddress, nftId, indexOfOfferMapping);
            return await receipt.wait();
        } catch (error) {
            throw error;
        }
    }

    async offersOf(
        collectionAddress: Address,
        nftId: string
    ): Promise<BigNumber> {
        try {
            const dataNFT = await this.getDataNFT(collectionAddress, nftId);
            return dataNFT.totalOffers;
        } catch (error: any) {
            throw error;
        }
    }

    async getDataNFT(
        collectionAddress: Address,
        nftId: string
    ): Promise<NFTForSale> {
        try {
            const dataNFT: NFTForSale = await (
                await this.instance()
            ).nftsListed(collectionAddress, nftId);
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

    plotUri(receipt: Receipt) {
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
