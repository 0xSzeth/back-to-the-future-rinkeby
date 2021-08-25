import { BigDecimal, BigInt, Address, ByteArray, crypto, ethereum } from "@graphprotocol/graph-ts"
import {
  DInterest,
  EDeposit,
  EFund,
  EPayFundingInterest,
  ERolloverDeposit,
  ESetParamAddress,
  ESetParamUint,
  ETopupDeposit,
  EWithdraw,
  OwnershipTransferred
} from "../generated/DInterest/DInterest"
import { IInterestOracle } from "../generated/DInterest/IInterestOracle"
import { DPool } from "../generated/schema"

let YEAR = BigInt.fromI32(31556952); // One year in seconds
let ZERO_DEC = BigDecimal.fromString('0')
let POOL_ADDRESSES = new Array<string>(0);
POOL_ADDRESSES.push("0x71482f8cd0e956051208603709639fa28cbc1f33"); // cDAI
POOL_ADDRESSES.push("0x3d59EcA28fC3CA2338951A7C8E0C435a1691550b"); // cUSDC

export function keccak256(s: string): ByteArray {
  return crypto.keccak256(ByteArray.fromUTF8(s));
}

export function tenPow(exponent: number): BigInt {
  let result = BigInt.fromI32(1);
  for (let i = 0; i < exponent; i++) {
    result = result.times(BigInt.fromI32(10));
  }
  return result;
}

export function normalize(i: BigInt, decimals: number = 18): BigDecimal {
  return i.toBigDecimal().div(new BigDecimal(tenPow(decimals)));
}

export function getPool(poolAddress: string): DPool {
  let pool = DPool.load(poolAddress);
  if (pool == null) {
    pool = new DPool(poolAddress);
    let poolContract = DInterest.bind(Address.fromString(poolAddress));
    let oracleContract = IInterestOracle.bind(poolContract.interestOracle());

    pool.address = poolAddress;
    pool.moneyMarket = poolContract.moneyMarket().toHex();
    pool.stablecoin = poolContract.stablecoin().toHex();
    pool.interestModel = poolContract.interestModel().toHex();
    pool.historicalInterestPaid = ZERO_DEC;

    let oneYearInterestRate = poolContract.try_calculateInterestAmount(tenPow(18), YEAR);
    if (oneYearInterestRate.reverted) {
      pool.oneYearInterestRate = ZERO_DEC;
    } else {
      let value = oneYearInterestRate.value;
      pool.oneYearInterestRate = normalize(value);
    }

    let oracleInterestRate = oracleContract.try_updateAndQuery();
    if (oracleInterestRate.reverted) {
      pool.oracleInterestRate = ZERO_DEC;
    } else {
      let value = oracleInterestRate.value.value1;
      pool.oracleInterestRate = normalize(value);
    }

    pool.save();
  }
  return pool as DPool;
}

export function handleEDeposit(event: EDeposit): void {}

export function handleEFund(event: EFund): void {}

export function handleEPayFundingInterest(event: EPayFundingInterest): void {}

export function handleERolloverDeposit(event: ERolloverDeposit): void {}

export function handleESetParamAddress(event: ESetParamAddress): void {
  let pool = getPool(event.address.toHex());
  let paramName = event.params.paramName;
  if (paramName == keccak256("interestModel")) {
    pool.interestModel = event.params.newValue.toHex();
  }
  pool.save();
}

export function handleESetParamUint(event: ESetParamUint): void {}

export function handleETopupDeposit(event: ETopupDeposit): void {}

export function handleEWithdraw(event: EWithdraw): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleBlock(block: ethereum.Block): void {
  for (let i = 0; i < POOL_ADDRESSES.length; i++) {
    let poolID = POOL_ADDRESSES[i];
    let pool = getPool(poolID);
    let poolContract = DInterest.bind(Address.fromString(pool.address));
    let oracleContract = IInterestOracle.bind(poolContract.interestOracle());

    let oneYearInterestRate = poolContract.try_calculateInterestAmount(tenPow(18), YEAR);
    if (oneYearInterestRate.reverted) {
      // do nothing
    } else {
      let value = oneYearInterestRate.value;
      pool.oneYearInterestRate = normalize(value);
    }

    let oracleInterestRate = oracleContract.try_updateAndQuery();
    if (oracleInterestRate.reverted) {
      // do nothing
    } else {
      let value = oracleInterestRate.value.value1;
      pool.oracleInterestRate = normalize(value);
    }

    pool.save();
  }
}
