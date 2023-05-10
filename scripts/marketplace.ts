
import { ethers } from "hardhat";
import { Address, Receipt } from "hardhat-deploy/types";
import { EventFilter, Event, Contract, Signer } from "ethers";
import { LogDescription } from "@ethersproject/abi";
import { throws } from "assert";


class Marketplace {
    contractAddress: Address;
    signer: Signer;

    constructor(contractAddress: Address, signer: Signer) {
        this.contractAddress = contractAddress;
        this.signer = signer;
    }

    async totalOfNFTListed(): Promise<String> {
        try{
            const allNFTListedEventEmitted = await this.getEvents("NFTListed");
            const allNFTSoldEventEmitted = await this.getEvents("NFTSold");
            const nftsListed = allNFTListedEventEmitted.length;
            const nftsSold = allNFTSoldEventEmitted.length;
            if (nftsListed < nftsSold) {
                throw Error("Error because NFTSold is greater than NFTListed.");
            }
            return (nftsListed-nftsSold).toString();
        }catch(error:any){
            throw error;
        }
    }

    async list(collectionAddress:Address, nftId:string, price:string): Promise<String> {
        try{
            const receipt = await (await this.instance()).list(collectionAddress, nftId, price);
            return this.plotUri(await receipt.wait());
        }catch(error:any){
            throw error;
        }
        
    }

    private plotUri(receipt: Receipt) {
        return this.uriScanner(receipt.transactionHash);
    }

    uriScanner(txHash:string) {
        return `https://mumbai.polygonscan.com/tx/${txHash}`;
    }

    private async getEvents(eventName: string): Promise<LogDescription[]> {
        const marketplaceInstance: Contract = await this.instance();
        const filter: EventFilter = {
            address: marketplaceInstance.address,
            topics: marketplaceInstance.filters[eventName]().topics,
        };
        const logs = await marketplaceInstance.provider.getLogs(filter);
        const events = logs.map(log => marketplaceInstance.interface.parseLog(log));
        return events;
    }

    private async instance(): Promise<Contract> {
        try {
            const instanceRetrieved = await ethers.getContractAt("Marketplace", this.contractAddress, this.signer);
            return instanceRetrieved;
        }catch(error:any){
            throw error;
        }
    }
}

export {Marketplace}

