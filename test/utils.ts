import { BigNumber } from "ethers";

export const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

export function toABDKMath64x64(value: number) {
    const _2Pow64 = BigNumber.from(2).pow(64);
    const _100 = BigNumber.from(100);
    return _2Pow64.mul(value).div(_100);
}
