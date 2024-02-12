import {
    ExternalProvider,
    JsonRpcFetchFunc,
    JsonRpcSigner,
    TransactionResponse,
} from "@ethersproject/providers";
import { deployments, web3, ethers } from "hardhat";
import SkaleMarketplaceWrapper from "../scripts/skale-marketplace-wrapper";
import { expect } from "chai";
import { toABDKMath64x64 } from "./utils";
import { contractNames } from "../utils/constants";
import { BigNumber, Signer, Wallet, constants } from "ethers";
import assert from "assert";
import { Address } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import { waitAndReturn } from "../utils/transactions";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SkaleMarketplaceWrapper", () => {
    let marketplaceWrapper: SkaleMarketplaceWrapper;
    const provider = ethers.provider;
    let funder: Wallet;
    const fundingAmount = parseEther("1");

    beforeEach(async () => {
        await deployments.fixture([
            contractNames.MockERC20,
            contractNames.Erc20PaymentMarketplace,
            contractNames.NebulaFaucet,
        ]);

        funder = ethers.Wallet.createRandom().connect(ethers.provider);

        marketplaceWrapper = await getMarketplaceWrapperFromFaucetCaller(
            funder
        );

        marketplaceWrapper.fundingAmount = fundingAmount;

        await fundFaucetCaller(funder);

        const faucetAddress = await getFaucetAddress();
        await fundFaucet(faucetAddress, funder);
    });

    async function getMarketplaceWrapperFromFaucetCaller(faucetCaller: Wallet) {
        const { address: marketplaceAddress, abi: marketplaceAbi } =
            await getDeployment(contractNames.Erc20PaymentMarketplace);
        const { address: erc20Address, abi: erc20Abi } = await getDeployment(
            contractNames.MockERC20
        );

        const provider = web3.currentProvider as
            | ExternalProvider
            | JsonRpcFetchFunc;

        return new SkaleMarketplaceWrapper(
            marketplaceAddress,
            marketplaceAbi,
            erc20Address,
            erc20Abi,
            faucetCaller.privateKey,
            provider
        );
    }

    async function getDeployment(contractName: string) {
        const deployment = await deployments.get(contractName);
        const { address, abi } = deployment;
        return { address, abi };
    }

    async function getFaucetAddress() {
        const { address: faucetAddress } = await deployments.get(
            contractNames.NebulaFaucet
        );
        return faucetAddress;
    }

    async function fundFaucetCaller(faucetCaller: Wallet) {
        const { deployer } = await ethers.getNamedSigners();
        await waitAndReturn(
            deployer.sendTransaction({
                to: faucetCaller.address,
                value: fundingAmount.mul(1000),
            })
        );
    }

    async function fundFaucet(faucetAddress: Address, faucetCaller: Signer) {
        await waitAndReturn(
            faucetCaller.sendTransaction({
                to: faucetAddress,
                value: fundingAmount.mul(100),
            })
        );
    }

    it("should call marketplace method when calling ensureSFuelAndDo", async () => {
        const feeRatio = await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.contract.feeRatio()
        );
        expect(feeRatio).to.equal(toABDKMath64x64(2));
    });

    it("should call marketplace non-readonly method even if user hasn't sFUEL", async () => {
        await makeDeployerUserBalanceToBe0();

        await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.setFeeRatioFromPercentage(3)
        );

        const feeRatio = await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.contract.feeRatio()
        );
        expect(feeRatio).to.equal(toABDKMath64x64(3));
    });

    async function makeDeployerUserBalanceToBe0() {
        const { deployer } = await ethers.getNamedSigners();

        await reduceBalanceTo(deployer, BigNumber.from(0));

        const afterBurningBalance = await deployer.getBalance();
        assert(afterBurningBalance.isZero());
    }

    it("should not get sFUEL for faucetCaller if he has < fundingAmount/100", async () => {
        const lessThanRewardDiv100 = fundingAmount.div(100).sub(1);
        await reduceBalanceTo(funder, lessThanRewardDiv100);

        await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.setFeeRatioFromPercentage(3)
        );

        const minBalanceAfterFaucetPaid = fundingAmount;
        expect(await funder.getBalance()).to.be.lt(minBalanceAfterFaucetPaid);
    });

    async function reduceBalanceTo(signer: Signer, desiredBalance: BigNumber) {
        const balance = await signer.getBalance();
        const gasPrice = await provider.getGasPrice();
        const STANDARD_GAS_LIMIT_FOR_ETH_TRANSFER = 21000;
        const gasLimit = ethers.utils.hexlify(
            STANDARD_GAS_LIMIT_FOR_ETH_TRANSFER
        );
        const totalGasCost = gasPrice.mul(gasLimit);
        const amountToBurn = balance.sub(desiredBalance).sub(totalGasCost);

        await waitAndReturn(
            signer.sendTransaction({
                to: constants.AddressZero,
                value: amountToBurn,
                gasLimit,
                gasPrice,
            })
        );
    }

    it("should not get sFUEL for faucetCaller if he has >= funding amount", async () => {
        await reduceBalanceTo(funder, fundingAmount);

        await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.setFeeRatioFromPercentage(3)
        );

        const faucetCallerBalance = await funder.getBalance();
        const minBalanceAfterFaucetPaid = fundingAmount;
        expect(faucetCallerBalance.lte(minBalanceAfterFaucetPaid)).to.be.true;
    });

    it("should transfer `user's balance - wrapper.fundigAmount()` from funder to user if later has < funding amount", async () => {
        const BALANCE_MINUS_FUNDING_AMOUNT = 100;
        const lessThanFundingAmount = fundingAmount.sub(
            BALANCE_MINUS_FUNDING_AMOUNT
        );
        const { deployer: connectedAddress } = await ethers.getNamedSigners();
        await reduceBalanceTo(connectedAddress, lessThanFundingAmount);

        await marketplaceWrapper
            .withSigner(connectedAddress as unknown as JsonRpcSigner)
            .ensureSFuelAndDo((w) => w.setFeeRatioFromPercentage(3));

        const trxs = await getPreviousBlockTrxs();

        expect(trxs.length).to.equal(1);

        const [{ from, to, value }] = trxs;
        expect(from).to.equal(funder.address);
        expect(to).to.equal(connectedAddress.address);
        expect(value).to.equal(BALANCE_MINUS_FUNDING_AMOUNT);
    });

    async function getPreviousBlockTrxs() {
        return provider
            .getBlockWithTransactions((await time.latestBlock()) - 1)
            .then((b) => b.transactions);
    }

    it("should not transfer anything from funder to user if user has >= funding amount", async () => {
        const { deployer: connectedSigner } = await ethers.getNamedSigners();
        await marketplaceWrapper
            .withSigner(connectedSigner as unknown as JsonRpcSigner)
            .ensureSFuelAndDo((w) => w.setFeeRatioFromPercentage(3));

        const trxs = await getPreviousBlockTrxs();

        expectNoneFromFunderTo(trxs, connectedSigner.address);
    });

    function expectNoneFromFunderTo(trxs: TransactionResponse[], to: Address) {
        for (const t of trxs) {
            if (t.from === funder.address && t.to === to)
                expect(true).to.be.false;
        }
    }
});
