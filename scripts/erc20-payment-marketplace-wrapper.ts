import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import MarketplaceWrapper, {
    Address,
    NotUndefined,
} from "./marketplace-wrapper";
import { BigNumber, Contract, ContractTransaction, Signer } from "ethers";
import { IERC20, IErc20PaymentMarketplace } from "../typechain-types";

export default class Erc20PaymentMarketplaceWrapper extends MarketplaceWrapper {
    private _erc20: IERC20;

    constructor(
        marketplaceAddress: Address,
        marketplaceAbi: NotUndefined,
        erc20Address: Address,
        erc20Abi: NotUndefined,
        provider: ExternalProvider | JsonRpcFetchFunc,
        confirmations: number | undefined = undefined
    ) {
        super(marketplaceAddress, marketplaceAbi, provider, confirmations);

        this._erc20 = new Contract(erc20Address, erc20Abi) as IERC20;
        this.withSignerIndex(0);
    }

    withSignerIndex(index: number) {
        super.withSignerIndex(index);

        const signer = this.provider.getSigner(index);
        this._erc20 = this._erc20.connect(signer);

        return this;
    }

    withSigner(signer: Signer): this {
        super.withSigner(signer);

        this._erc20 = this._erc20.connect(signer);

        return this;
    }

    get contract() {
        return this._contract as IErc20PaymentMarketplace;
    }

    async buy(
        collectionAddress: string,
        nftId: number | BigNumber,
        valueToSent: number | BigNumber
    ): Promise<ContractTransaction> {
        await this.erc20ApproveIfNecessary(valueToSent);

        return await this.waitAndReturn(
            this.contract.buy(collectionAddress, nftId)
        );
    }

    private async erc20ApproveIfNecessary(amount: BigNumber | number) {
        const allowance = await this.getAllowance();
        if (allowance.lt(amount)) {
            await this.reduceAllowanceToZeroToAvoidExploit();
            await this.waitAndReturn(
                this._erc20.approve(this.contract.address, amount)
            );
        }
    }

    private async getAllowance() {
        return this._erc20.allowance(
            this.contract.signer.getAddress(),
            this.contract.address
        );
    }

    private async reduceAllowanceToZeroToAvoidExploit() {
        // see https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
        await this.waitAndReturn(this._erc20.approve(this.contract.address, 0));
    }

    async makeOffer(
        collectionAddress: string,
        nftId: number | BigNumber,
        offerPrice: number | BigNumber,
        durationInDays: number
    ) {
        await this.erc20ApproveIfNecessary(offerPrice);

        return await this.waitAndReturn(
            this.contract.makeOffer(
                collectionAddress,
                nftId,
                offerPrice,
                durationInDays
            )
        );
    }

    async takeCounteroffer(
        id: number | BigNumber,
        valueToSent: number | BigNumber
    ) {
        await this.erc20ApproveIfNecessary(valueToSent);

        return await this.waitAndReturn(this.contract.takeCounteroffer(id));
    }
}
