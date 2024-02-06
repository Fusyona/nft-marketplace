import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import { deployments, web3, ethers } from "hardhat";
import SkaleMarketplaceWrapper from "../scripts/skale-marketplace-wrapper";
import { expect } from "chai";
import { toABDKMath64x64 } from "./utils";
import { contractNames } from "../utils/constants";
import { BigNumber, Signer, Wallet, constants } from "ethers";
import assert from "assert";
import { Address } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import { NebulaFaucet } from "../typechain-types";
import { waitAndReturn } from "../utils/transactions";

describe("SkaleMarketplaceWrapper", () => {
    let marketplaceWrapper: SkaleMarketplaceWrapper;
    const provider = ethers.provider;
    let faucetCaller: Wallet;
    const faucetReward = parseEther("1");

    beforeEach(async () => {
        await deployments.fixture([
            contractNames.MockERC20,
            contractNames.Erc20PaymentMarketplace,
            contractNames.NebulaFaucet,
        ]);

        faucetCaller = ethers.Wallet.createRandom().connect(ethers.provider);

        marketplaceWrapper = await getMarketplaceWrapperFromFaucetCaller(
            faucetCaller
        );

        await setFaucetReward(faucetReward);

        await fundFaucetCaller(faucetCaller);

        const faucetAddress = await getFaucetAddress();
        await fundFaucet(faucetAddress, faucetCaller);
    });

    async function getMarketplaceWrapperFromFaucetCaller(faucetCaller: Wallet) {
        const { marketplaceAddress, marketplaceAbi } =
            await getMarketplaceDeployment();
        const { erc20Address, erc20Abi } = await getErc20Deployment();
        const faucetAddress = await getFaucetAddress();

        const provider = web3.currentProvider as
            | ExternalProvider
            | JsonRpcFetchFunc;

        return new SkaleMarketplaceWrapper(
            marketplaceAddress,
            marketplaceAbi,
            erc20Address,
            erc20Abi,
            faucetAddress,
            faucetCaller.privateKey,
            provider
        );
    }

    async function getMarketplaceDeployment() {
        const marketplaceDeployment = await deployments.get(
            contractNames.Erc20PaymentMarketplace
        );
        const { address: marketplaceAddress, abi: marketplaceAbi } =
            marketplaceDeployment;
        return { marketplaceAddress, marketplaceAbi };
    }

    async function getErc20Deployment() {
        const erc20Deployment = await deployments.get(contractNames.MockERC20);
        const { address: erc20Address, abi: erc20Abi } = erc20Deployment;
        return { erc20Address, erc20Abi };
    }

    async function getFaucetAddress() {
        const { address: faucetAddress } = await deployments.get(
            contractNames.NebulaFaucet
        );
        return faucetAddress;
    }

    async function setFaucetReward(newReward: BigNumber) {
        const { deployer } = await ethers.getNamedSigners();
        const faucet = (await ethers.getContract(
            contractNames.NebulaFaucet
        )) as NebulaFaucet;
        await waitAndReturn(faucet.connect(deployer).updateAmount(newReward));
    }

    async function fundFaucetCaller(faucetCaller: Wallet) {
        const { deployer } = await ethers.getNamedSigners();
        await waitAndReturn(
            deployer.sendTransaction({
                to: faucetCaller.address,
                value: faucetReward.mul(1000),
            })
        );
    }

    async function fundFaucet(faucetAddress: Address, faucetCaller: Signer) {
        await waitAndReturn(
            faucetCaller.sendTransaction({
                to: faucetAddress,
                value: faucetReward.mul(100),
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
        await makeDefaultUserBalanceToBe0();

        await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.setFeeRatioFromPercentage(3)
        );

        const feeRatio = await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.contract.feeRatio()
        );
        expect(feeRatio).to.equal(toABDKMath64x64(3));
    });

    async function makeDefaultUserBalanceToBe0() {
        const { deployer: defaultUser } = await ethers.getNamedSigners();

        await reduceBalanceTo(defaultUser, BigNumber.from(0));

        const afterBurningBalance = await defaultUser.getBalance();
        assert(afterBurningBalance.isZero());
    }

    it("should get sFUEL for faucetCaller if he has < faucet/100 reward", async () => {
        const lessThanRewardDiv100 = faucetReward.div(100).sub(1);
        await reduceBalanceTo(faucetCaller, lessThanRewardDiv100);

        await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.setFeeRatioFromPercentage(3)
        );

        const minBalanceAfterFaucetPaid = faucetReward;
        expect((await faucetCaller.getBalance()).gte(minBalanceAfterFaucetPaid))
            .to.be.true;
    });

    async function reduceBalanceTo(signer: Signer, desiredBalance: BigNumber) {
        const balance = await signer.getBalance();
        const gasPrice = await provider.getGasPrice();
        const gasLimit = ethers.utils.hexlify(21000); // Standard gas limit for ETH transfer
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

    it("should not get sFUEL for faucetCaller if he has >= faucet reward", async () => {
        await reduceBalanceTo(faucetCaller, faucetReward);

        await marketplaceWrapper.ensureSFuelAndDo((w) =>
            w.setFeeRatioFromPercentage(3)
        );

        const faucetCallerBalance = await faucetCaller.getBalance();
        const minBalanceAfterFaucetPaid = faucetReward;
        expect(faucetCallerBalance.lte(minBalanceAfterFaucetPaid)).to.be.true;
    });
});
