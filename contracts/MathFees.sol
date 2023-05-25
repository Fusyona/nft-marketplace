// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

library MathFees {
    function _verifyFeeRatioBounds(
        int128 _percentageMultipliedBy2Up64AndTwoDecimals
    ) internal pure returns (bool) {
        require(
            _percentageMultipliedBy2Up64AndTwoDecimals > 0 &&
                _percentageMultipliedBy2Up64AndTwoDecimals <=
                _getMaxValueStoredInUint128(),
            "Math: Value of feeRatio is out of bound."
        );
        require(
            _getRemainderOfUint128(
                _percentageMultipliedBy2Up64AndTwoDecimals
            ) == 0,
            "Math: You need to encode the argument as: percentage*100*2^64."
        );
        return true;
    }

    function _getMaxValueStoredInUint128() internal pure returns (int128) {
        return int128(0x7fffffffffffffffffffffffffffffff);
    }

    function _getRemainderOfUint128(
        int128 _percentageMultipliedBy2Up64AndTwoDecimals
    ) internal pure returns (int128) {
        require(
            _percentageMultipliedBy2Up64AndTwoDecimals > 0,
            "Math: Value should be greater than 0."
        );
        int128 denominator = 2 ** 64;
        return _percentageMultipliedBy2Up64AndTwoDecimals % denominator;
    }

    function _computeFeeRatio(
        int128 _percentageMultipliedBy2Up64AndTwoDecimals
    ) internal pure returns (int128) {
        return ((_percentageMultipliedBy2Up64AndTwoDecimals /
            _twoDecimalsPerPercentageInput()) / int128(100));
    }

    function _npercent(int128 percent) internal pure returns (int128) {
        return (percent * int128(2 ** 64)) / int128(100);
    }

    function _twoDecimalsPerPercentageInput() private pure returns (int128) {
        return int128(100);
    }
}
