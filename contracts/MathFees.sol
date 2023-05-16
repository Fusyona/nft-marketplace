// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

library MathFees {

function _verifyFeeRatioBounds(int128 value) internal pure returns (bool) {
    require(value > 0 && value <= _getMaxValueStoredInUint128(), "Math: Value of feeRatio is out of bound.");
    require(_getRemainderOfUint128(value) == 0, "Math: You need to encode the argument as: percentage*100*2^64.");
    return true;
    }


function _getMaxValueStoredInUint128() internal pure returns(int128) {
    return int128(0x7fffffffffffffffffffffffffffffff);
    }

function _getRemainderOfUint128(int128 value) internal pure returns(int128) {
    require(value > 0, "Math: Value should be greater than 0.");
    int128 denominator = 2**64;
    return value % denominator;
    }

function _computeFeeRatio(int128 value) internal pure returns (int128) {
    return ((value / _twoDecimalsForPercentageInput()) /int128(100));
    }

function _npercent(int128 percent) internal pure returns(int128) {
    return (percent * int128(2**64))/ int128(100);
    }   

function _twoDecimalsForPercentageInput() private pure returns (int128) {
    return int128(100);
    }

}