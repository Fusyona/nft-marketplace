import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Hash } from "crypto";
import { ethers } from "hardhat";
import { Address, Receipt } from "hardhat-deploy/types";
import { EventFilter, Event, Contract, Signer } from "ethers";
import { LogDescription } from "@ethersproject/abi";


class Marketplace {
    contractAddress: Address;
    signer: Signer;

    constructor(contractAddress: Address, signer: Signer) {
        this.contractAddress = contractAddress;
        this.signer = signer;
    }

    async liquidity(): Promise<String> {
        try{
            const allNFTListedEventsEmitted = await this.getEvents("NFTListed");
            const totalOfNFTListed = allNFTListedEventsEmitted.length;
            return totalOfNFTListed.toString();
        }catch(error){
            throw error;
        }
    }

    async list(collectionAddress:Address, nftId:string): Promise<String> {
        try{
            const receipt:Receipt = (await this.instance()).list(collectionAddress, nftId);
            return this.plotUri(receipt);
        }catch(error){
            throw error;
        }
        
    }

    private plotUri(receipt: Receipt) {
        return this.uriScanner(receipt.transactionHash);
    }

    uriScanner(txHash:string) {
        return `https://mumbai.polygonscan.com/${txHash}`;
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
        const instanceRetrieved = await ethers.getContractAt("Marketplace", this.contractAddress, this.signer);
        return instanceRetrieved;
    }
}

export {Marketplace}

