import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import MarketplaceWrapper, {
    Address,
    NotUndefined,
} from "./marketplace-wrapper";
import { BigNumber } from "ethers";
import { IMsgValuePaymentMarketplace } from "../typechain-types";

export default class MsgValuePaymentMarketplaceWrapper extends MarketplaceWrapper {
    constructor(
        contractAddress: Address,
        contractAbi: NotUndefined,
        provider: ExternalProvider | JsonRpcFetchFunc,
        confirmations: number | undefined = undefined
    ) {
        super(contractAddress, contractAbi, provider, confirmations);
    }

    get contract() {
        return this._contract as IMsgValuePaymentMarketplace;
    }

    async buy(
        collectionAddress: Address,
        nftId: number | BigNumber,
        valueToSent: number | BigNumber
    ) {
        return await this.waitAndReturn(
            this.contract.buy(collectionAddress, nftId, { value: valueToSent })
        );
    }

    async makeOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        offerPrice: number | BigNumber,
        durationInDays: number
    ) {
        return await this.waitAndReturn(
            this.contract.makeOffer(collectionAddress, nftId, durationInDays, {
                value: offerPrice,
            })
        );
    }

    async takeCounteroffer(
        id: BigNumber | number,
        valueToSent: BigNumber | number
    ) {
        return await this.waitAndReturn(
            this.contract.takeCounteroffer(id, { value: valueToSent })
        );
    }
}
